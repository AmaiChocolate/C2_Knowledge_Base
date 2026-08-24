import sys
import re

def extract_text_from_pdf(pdf_path):
    try:
        # Try importing pypdf
        try:
            from pypdf import PdfReader
            reader = PdfReader(pdf_path)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            print("Successfully extracted text using pypdf:")
            print(text)
            return
        except ImportError:
            pass
            
        try:
            # Try PyPDF2
            import PyPDF2
            with open(pdf_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                text = ""
                for page in reader.pages:
                    text += page.extract_text() + "\n"
            print("Successfully extracted text using PyPDF2:")
            print(text)
            return
        except ImportError:
             pass

        # Fallback: strings extraction (very basic)
        print("PDF libraries not found. Attempting basic string extraction...")
        with open(pdf_path, 'rb') as f:
            content = f.read()
            # Find sequences of printable characters
            strings = re.findall(b"[a-zA-Z0-9\s\(\)\-\.\,]{4,}", content)
            text = "\n".join([s.decode('utf-8', errors='ignore') for s in strings])
            print(text)

    except Exception as e:
        print(f"Error extracting text: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python extract_pdf_text.py <pdf_path>")
        sys.exit(1)
    
    extract_text_from_pdf(sys.argv[1])
