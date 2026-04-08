def deduplicate_documents(documents : List[Document]):
  seen = set()
  deduplicated = []

  for doc in documents:
    content=doc.page_content.strip()
    if content not in seen:
      seen.add(content)
      dedulpicated.append(doc)
  return deduplicated
  pass
