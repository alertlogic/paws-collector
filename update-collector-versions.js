const fs = require('fs');

// check if arg is a semver.
if (!process.argv[2].match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/)){
    console.log("Please provide valid semver version. i.e 1.0.0")
    return
}

const directories = fs.readdirSync('collectors')
    .filter(dir => fs.lstatSync(`collectors/${dir}`).isDirectory())
    // exclude template form this auto update because it will make the whole scrip too complex. well do it as a special case later
    .filter(dir => dir !== 'template');

directories.forEach(dir => updatePackageJson(dir, 'package.json'));
updatePackageJson('template', 'package.json.template', false);

function updatePackageJson(folder, fileName, updateVersion = true) {
    const file = `collectors/${folder}/${fileName}`;
    const package = JSON.parse(fs.readFileSync(file, 'utf8'));
    package.dependencies['@alertlogic/paws-collector'] = `^${process.argv[2]}`;

    if(updateVersion){
        const version = package.version.split('.').map(e => parseInt(e))
        version[2]++;
        package.version = version.map(e => e.toString()).join('.');
    }

    fs.writeFileSync(file, JSON.stringify(package, null, 2), 'utf8');

}
