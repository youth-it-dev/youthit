export const decodeHtmlEntities = (str: string): string => {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = str;
  return textarea.value;
};
