def clean_text(text: str) -> str:
    text = text.replace("\n", " ")
    text = text.replace("\t", " ")
    text = " ".join(text.split())  # remove extra spaces
    return text.strip()


def clean_documents(docs):
    for doc in docs:
        doc.page_content = clean_text(doc.page_content)
    return docs