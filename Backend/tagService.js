const natural = require('natural');
const stopwords = require('stopwords').english;

function generateTags(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  const tokenizer = new natural.WordTokenizer();
  const tokens = tokenizer.tokenize(text);
  
  const filtered = tokens.filter(word => 
    word.length > 3 && 
    !stopwords.includes(word) &&
    /^[a-z]+$/.test(word)
  );
  
  const frequency = {};
  filtered.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });
  
  const sorted = Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
  
  return sorted.length > 0 ? sorted : ['General'];
}

module.exports = { generateTags };
