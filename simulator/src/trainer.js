/**
 * Brevity & systems trainer — aligned with KB / MQF study figures
 */

class BrevityTrainer {
    constructor() {
        this.currentQuiz = null;
        this.score = { correct: 0, total: 0 };

        this.database = {
            brevity: [
                { q: "What does BOGEY mean?", a: "A radar or visual contact whose identity is unknown.", options: ["A confirmed hostile contact", "A radar or visual contact whose identity is unknown.", "A friendly contact", "A contact that is jamming"] },
                { q: "What does BANDIT mean?", a: "An identified enemy aircraft.", options: ["A confirmed hostile contact", "An identified enemy aircraft.", "An unknown contact", "A friendly contact"] },
                { q: "What does HOSTILE mean?", a: "A contact identified as enemy upon which clearance to fire is authorized.", options: ["An identified enemy aircraft", "A contact identified as enemy upon which clearance to fire is authorized.", "A contact with a diamond symbol", "Any contact within the BMA"] },
                { q: "What is SPADES?", a: "An interrogated group/contact that lacks required ATO IFF/SIF modes and codes for the ID matrix.", options: ["A contact that is jamming", "An interrogated group/contact that lacks required ATO IFF/SIF modes and codes for the ID matrix.", "A contact moving cold", "A contact at low altitude"] },
                { q: "What does LEAKER mean?", a: "Airborne threat has passed through a defensive layer.", options: ["A contact that is low on fuel", "Airborne threat has passed through a defensive layer.", "A contact that is escaping", "A missed intercept"] },
                { q: "What is BULLSEYE?", a: "An established reference point from which the position of an object can be referenced.", options: ["The center of the BMA", "An established reference point from which the position of an object can be referenced.", "The location of the AWACS", "The primary CAP point"] }
            ],
            systems: [
                { q: "After opening BC3 on your scope, what do you set up next? (MQF)", a: "Scope Profile", options: ["Discovery Chat", "Radios", "Scope Profile", "Set reference on bullseye"] },
                { q: "AN/TPS-75 max range / max altitude (study figure)?", a: "240 NM / 95,500 ft", options: ["250/85,500", "230/95,500", "240 NM / 95,500 ft", "340/95,500"] },
                { q: "Max TPS-75 frequencies enabled at once for EMCON planning?", a: "16", options: ["16", "24", "8", "12"] },
                { q: "Who controls EA effects using TPS-75 EP functions?", a: "EPT", options: ["EPT", "WD", "ABM", "SL"] },
                { q: "In this trainer, what is the TPS-75?", a: "Radar track feed into the BC3 scope (no separate console)", options: ["A second UI panel", "Radar track feed into the BC3 scope (no separate console)", "Only a Link-16 gateway", "Voice radio stack"] }
            ],
            tactics: [
                { q: "Primary separation for a WALL label?", a: "Lateral / azimuth", options: ["Lateral / azimuth", "Range / depth only", "Altitude only", "Speed gate"] },
                { q: "Primary separation for a LADDER label?", a: "Range / depth", options: ["Lateral / azimuth", "Range / depth", "IFF mode", "Fuel state"] },
                { q: "Doctrinal grouping distance used in this sim clusterer?", a: "About 3 NM", options: ["1 NM", "About 3 NM", "10 NM", "25 NM"] },
                { q: "Picture call order starts with?", a: "Callsign, then group count", options: ["Altitude first", "Callsign, then group count", "ROE code only", "Bullseye only"] },
                { q: "Aspect HOT roughly means?", a: "Target nose-on / high aspect toward fighter", options: ["Target cold / fleeing", "Target nose-on / high aspect toward fighter", "Beam only", "On the ground"] }
            ]
        };
    }

    startQuiz(category) {
        let questions = [];
        if (category === 'mixed') {
            questions = [...this.database.brevity, ...this.database.systems, ...this.database.tactics];
        } else {
            questions = this.database[category] || [];
        }
        if (!questions.length) {
            alert('No questions for that category');
            return;
        }
        this.currentQuiz = {
            category,
            questions: this.shuffle([...questions]),
            currentIndex: 0
        };
        this.showQuestion();
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    showQuestion() {
        const quiz = this.currentQuiz;
        if (quiz.currentIndex >= quiz.questions.length) {
            this.finishQuiz();
            return;
        }
        const q = quiz.questions[quiz.currentIndex];
        const container = document.getElementById('quizContainer');
        const options = this.shuffle([...q.options]);
        container.innerHTML = `
            <div class="quiz-question">
                <p style="font-size: 16px; margin-bottom: 20px;"><strong>${q.q}</strong></p>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${options.map(opt => `
                        <button onclick="trainer.checkAnswer(${JSON.stringify(opt)})" class="quiz-option">${opt}</button>
                    `).join('')}
                </div>
                <p style="margin-top: 20px; color: #666; font-size: 11px;">Question ${quiz.currentIndex + 1} of ${quiz.questions.length}</p>
            </div>
        `;
    }

    checkAnswer(answer) {
        const quiz = this.currentQuiz;
        const q = quiz.questions[quiz.currentIndex];
        this.score.total++;
        if (answer === q.a) {
            this.score.correct++;
            this.showFeedback(true, q.a);
        } else {
            this.showFeedback(false, q.a);
        }
        this.updateStats();
    }

    showFeedback(isCorrect, correctAnswer) {
        const container = document.getElementById('quizContainer');
        container.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <h2 style="color: ${isCorrect ? '#00ff00' : '#ff0000'}; margin-bottom: 15px;">
                    ${isCorrect ? 'CORRECT' : 'INCORRECT'}
                </h2>
                <p style="margin-bottom: 25px;">${isCorrect ? 'Good.' : `Correct answer:<br><strong>${correctAnswer}</strong>`}</p>
                <button onclick="trainer.nextQuestion()" style="width: 100%;">Next</button>
            </div>
        `;
    }

    nextQuestion() {
        this.currentQuiz.currentIndex++;
        this.showQuestion();
    }

    updateStats() {
        const stats = document.getElementById('trainerStats');
        const accuracy = Math.round((this.score.correct / this.score.total) * 100) || 0;
        stats.innerHTML = `
            <p>Correct: ${this.score.correct}</p>
            <p>Attempts: ${this.score.total}</p>
            <p>Accuracy: ${accuracy}%</p>
        `;
    }

    finishQuiz() {
        const container = document.getElementById('quizContainer');
        const accuracy = Math.round((this.score.correct / this.score.total) * 100) || 0;
        container.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <h3>Quiz Complete</h3>
                <p style="font-size: 24px; margin: 20px 0;">${accuracy}%</p>
                <p>${this.score.correct} / ${this.score.total}</p>
                <button onclick="trainer.startQuiz('mixed')" style="margin-top: 20px;">Mixed again</button>
            </div>
        `;
    }
}

window.BrevityTrainer = BrevityTrainer;
