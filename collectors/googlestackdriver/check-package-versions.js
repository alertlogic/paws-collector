// This script is a final check to see if the lockfile deps are the same as the prod deps.
// it is meant as a speed bump to ensure an unupdated lockfile doesn't cause problems when building a package for prod

const lock = require('./package-lock.json');
const package = require('./package.json');

// iterate over the deps and see if the coresponting locked dep has the same version
if(lock){
    for(dep in package.dependencies){
        if(package.dependencies.hasOwnProperty(dep)){
            if(lock.dependencies[dep].version != package.dependencies[dep]){
                throw new Error(`Dep Mismatch: the version for ${dep} in package.json is ${package.dependencies[dep]} while it is ${lock.dependencies[dep].version} in the lock file. Please check that your lockfile is up to date before continuing.`);
            }
        }
    }
}
