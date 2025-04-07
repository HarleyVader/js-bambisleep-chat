import re

def tokenize_text(text):
    # Simple tokenization function
    return text.split()

def normalize_text(text):
    # Normalize text by converting to lowercase and stripping whitespace
    return text.lower().strip()

def preprocess_text(text):
    # Combine tokenization and normalization
    normalized_text = normalize_text(text)
    tokens = tokenize_text(normalized_text)
    return tokens

def clean_text(text):
    """Clean text by removing unnecessary characters and normalizing whitespace"""
    text = re.sub(r'[^\w\s,.?!]', '', text)  # Remove special characters
    text = re.sub(r'\s+', ' ', text)  # Normalize whitespace
    return text.strip()

def text_to_sequence(text):
    """Convert text to a sequence of character indices"""
    # This is a very simple implementation
    # In a real system, you would use a tokenizer or character map
    
    # Create a simple mapping from character to index
    char_to_id = {c: i+1 for i, c in enumerate(' abcdefghijklmnopqrstuvwxyz,.?!')}
    
    # Convert text to lowercase
    text = text.lower()
    
    # Convert each character to its index
    sequence = [char_to_id.get(c, 0) for c in text]
    
    return sequence