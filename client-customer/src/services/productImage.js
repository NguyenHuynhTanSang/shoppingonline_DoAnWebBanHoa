export default function getImageSrc(image) {
  const value = String(image || '').trim();
  if (!value) return '';
  if (value.startsWith('data:image')) return value;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('/')) return value;
  if (value.startsWith('./')) return value;
  return `data:image/jpg;base64,${value}`;
}
