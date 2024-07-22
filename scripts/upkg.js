const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const ignoreDirs = ['node_modules', 'dist', 'build']; // Add directories to ignore

// Function to read and parse package.json
const readPackageJson = (dir) => {
  const packageJsonPath = path.join(dir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  }
  return null;
};

// Function to write package.json
const writePackageJson = (dir, packageJson) => {
  const packageJsonPath = path.join(dir, 'package.json');
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
};

// Recursive function to get all directories, ignoring specified directories
const getDirectoriesRecursive = (dir) => {
  const dirs = [];
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory() && !ignoreDirs.includes(file)) {
      dirs.push(filePath);
      dirs.push(...getDirectoriesRecursive(filePath));
    }
  });

  return dirs;
};

// Get all directories recursively, ignoring specified directories
const allDirs = getDirectoriesRecursive(rootDir);

// Map to store package versions
const packageVersions = {};

// Read all package.json files and store their versions
allDirs.forEach(dir => {
  const packageJson = readPackageJson(dir);
  if (packageJson && packageJson.name && packageJson.version) {
    packageVersions[packageJson.name] = packageJson.version;
  }
});

// Update workspace:* dependencies with actual versions
allDirs.forEach(dir => {
  const packageJson = readPackageJson(dir);
  if (packageJson) {
    let modified = false;

    // Update dependencies
    Object.keys(packageJson.dependencies || {}).forEach(dep => {
      if (packageJson.dependencies[dep] === 'workspace:*' && packageVersions[dep]) {
        packageJson.dependencies[dep] = packageVersions[dep];
        modified = true;
      }
    });

    // Update devDependencies
    Object.keys(packageJson.devDependencies || {}).forEach(dep => {
      if (packageJson.devDependencies[dep] === 'workspace:*' && packageVersions[dep]) {
        packageJson.devDependencies[dep] = packageVersions[dep];
        modified = true;
      }
    });

    // Update peerDependencies
    Object.keys(packageJson.peerDependencies || {}).forEach(dep => {
      if (packageJson.peerDependencies[dep] === 'workspace:*' && packageVersions[dep]) {
        packageJson.peerDependencies[dep] = packageVersions[dep];
        modified = true;
      }
    });

    if (modified) {
      writePackageJson(dir, packageJson);
      console.log(`Updated ${path.join(dir, 'package.json')}`);
    }
  }
});
