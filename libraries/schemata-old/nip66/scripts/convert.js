const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Directories
const INPUT_DIR = './dist';
const OUTPUT_DIR = './dist';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Function to convert YAML to JSON
function convertYAMLtoJSON(filename) {
    const inputPath = path.join(INPUT_DIR, filename);
    const outputPath = path.join(OUTPUT_DIR, `${path.basename(filename, '.yaml')}.json`);

    const command = `yaml-convert --pretty true --input "${inputPath}" --output "${outputPath}"`;
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Stderr: ${stderr}`);
            return;
        }
        console.log(`Converted '${inputPath}' to '${outputPath}'`);
        console.log(stdout);
    });
}

// Read the input directory and process each YAML file
fs.readdir(INPUT_DIR, (err, files) => {
    if (err) {
        console.error(`Error reading directory ${INPUT_DIR}: ${err}`);
        return;
    }

    files.forEach(file => {
        if (path.extname(file) === '.yaml') {
            convertYAMLtoJSON(file);
        }
    });
});
