const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

// Function to get the list of workspaces from Yarn
const getWorkspacePackageJsonPaths = () => {
  try {
    const rawWorkspacesInfo = execSync('yarn workspaces info', { encoding: 'utf-8' });

    // Extract the JSON part from the output, Yarn adds extra lines sometimes
    const jsonStartIndex = rawWorkspacesInfo.indexOf('{');
    const jsonEndIndex = rawWorkspacesInfo.lastIndexOf('}');
    const workspacesInfo = JSON.parse(rawWorkspacesInfo.substring(jsonStartIndex, jsonEndIndex + 1));

    const packageJsonPaths = [];

    for (const workspace in workspacesInfo) {
      const location = workspacesInfo[workspace].location;
      const packageJsonPath = path.join(location, 'package.json');
      packageJsonPaths.push(packageJsonPath);
    }

    return packageJsonPaths;
  } catch (error) {
    console.error('Error retrieving Yarn workspaces info:', error);
    process.exit(1);
  }
};

// Main function to update package.json files
const updatePackageJsonFiles = () => {
  const packageJsonFiles = getWorkspacePackageJsonPaths();

  packageJsonFiles.forEach((filePath) => {
    const absoluteFilePath = path.resolve(filePath);

    // Check if the package.json exists
    if (fs.existsSync(absoluteFilePath)) {
      const packageJson = JSON.parse(fs.readFileSync(absoluteFilePath, 'utf-8'));

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
      fs.writeFileSync(absoluteFilePath, JSON.stringify(packageJson, null, 2), 'utf-8');
      console.log(`Updated ${absoluteFilePath}`);
    } else {
      console.warn(`package.json not found at ${absoluteFilePath}`);
    }
  });
};

updatePackageJsonFiles();
