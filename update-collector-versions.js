const fs = require('fs');
const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

// usage
if (process.argv.some(e => e === '--help' || e === '-h')){
    console.log("node update-paws-version.js [<paws-version>]");
}

// check if arg is a semver.
if (process.argv[2] && !process.argv[2].match(semverRegex)){
    console.log("Please provide valid semver version. i.e 1.0.0")
    return
}

// the current version derived from the package.json
const currentPaws = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// this is the version we will update the collectors to.
// If it is not explicitly set, then we'll grab the current version from the main package.json
const newPawsVersion = process.argv[2] ? process.argv[2] : currentPaws;

// get the collector directories and filter out the template dir.
// we'll handle the template dir as a special case later
const directories = fs.readdirSync('collectors')
    .filter(dir => fs.lstatSync(`collectors/${dir}`).isDirectory())
    .filter(dir => dir !== 'template');

directories.forEach(dir => updatePackageJson(dir, 'package.json'));
updatePackageJson('template', 'package.json.template', false);

function updatePackageJson(folder, fileName, updateVersion = true) {
    const file = `collectors/${folder}/${fileName}`;
    const package = JSON.parse(fs.readFileSync(file, 'utf8'));

    // if the version is already what we want to upgrade to, there is nothing to do
    if(package.dependencies['@alertlogic/paws-collector'].includes(newPawsVersion)){
        console.log(`${folder} is already up to date`);
        return
    }

    package.dependencies['@alertlogic/paws-collector'] = `^${process.argv[2]}`;

    if(updateVersion){
        const version = package.version.split('.').map(e => parseInt(e))
        version[2]++;
        package.version = version.map(e => e.toString()).join('.');
    }

    fs.writeFileSync(file, JSON.stringify(package, null, 2), 'utf8');

}
