<script>
const path = new URL(window.location).path 

const re = /\/relay\/([A-z0-9./-]+)\/@json/i;
const found = str.match(re);
if(path.includes(/relay/))
  document.documentElement.innerHTML = jsonString;
</script>