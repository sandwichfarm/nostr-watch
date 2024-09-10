const fs = require('fs');
const path = require('path');

// List of your internal package prefixes (like "@nostrwatch/")
const internalPackagePrefixes = ['@nostrwatch'];

// Function to check if a dependency is internal
const isInternalDependency = (dependencyName) => {
  return internalPackagePrefixes.some((prefix) => dependencyName.startsWith(prefix));
};

// Function to update dependencies in the package.json
const updateDependenciesToStar = (dependencies) => {
  for (const dep in dependencies) {
    if (isInternalDependency(dep)) {
      dependencies[dep] = '*';
    }
  }
  return dependencies;
};

// Path to the monorepo packages
const packagesDir = path.resolve(__dirname, 'packages');

// Recursively find all package.json files in the monorepo
const findPackageJsonFiles = (dir) => {
  const files = fs.readdirSync(dir);
  const packageJsonFiles = [];

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.lstatSync(filePath);

    if (stat.isDirectory()) {
      packageJsonFiles.push(...findPackageJsonFiles(filePath));
    } else if (file === 'package.json') {
      packageJsonFiles.push(filePath);
    }
  });

  return packageJsonFiles;
};

// Main function to update package.json files
const updatePackageJsonFiles = () => {
  const packageJsonFiles = findPackageJsonFiles(packagesDir);

  packageJsonFiles.forEach((filePath) => {
    const packageJson = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // Update dependencies, devDependencies, and peerDependencies if they exist
    if (packageJson.dependencies) {
      packageJson.dependencies = updateDependenciesToStar(packageJson.dependencies);
    }
    if (packageJson.devDependencies) {
      packageJson.devDependencies = updateDependenciesToStar(packageJson.devDependencies);
    }
    if (packageJson.peerDependencies) {
      packageJson.peerDependencies = updateDependenciesToStar(packageJson.peerDependencies);
    }

    // Write the updated package.json back to disk
    fs.writeFileSync(filePath, JSON.stringify(packageJson, null, 2), 'utf-8');
    console.log(`Updated ${filePath}`);
  });
};

module.exports = updatePackageJsonFiles;