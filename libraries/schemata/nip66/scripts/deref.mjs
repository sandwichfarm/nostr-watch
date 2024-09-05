#!/usr/bin/env node
import $RefParser from "@apidevtools/json-schema-ref-parser";
import fs from "fs";
import path from "path";

const inputDir = './src';  // Directory containing JSON files
const outputDir = './dist';  // Output directory for dereferenced files

// Ensure output directory exists
if (!fs.existsSync(outputDir)){
    fs.mkdirSync(outputDir, { recursive: true });
}

// Function to dereference a JSON file
async function dereferenceJson(filePath) {
    try {
        const dereferenced = await $RefParser.dereference(filePath);
        const outputFilePath = path.join(outputDir, `${path.basename(filePath, '.yaml')}.json`);
        fs.writeFileSync(outputFilePath, JSON.stringify(dereferenced, null, 2));
        console.log(`File successfully written: ${outputFilePath}`);
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error);
    }
}

// Read all files in the input directory and process each JSON file
fs.readdir(inputDir, (err, files) => {
    if (err) {
        console.error(`Error reading directory ${inputDir}:`, err);
        return;
    }

    files.forEach(file => {
        if (path.extname(file) === '.yaml') {
            const fullPath = path.join(inputDir, file);
            dereferenceJson(fullPath);
        }
    });
});