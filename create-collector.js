const fs = require('fs')

const name = process.argv[2]
const version = process.argv[3]
const prefix = process.argv[4]

//do some basic validation on the name for length and it suitability as a js varaible
if(!process.argv[2], !process.argv[3], !process.argv[4]){
    console.log("usage: npm run create-collector <<name>> <<version>> <<log-prefix>>")
    return
}
if(name.length < 2){
    throw new Error("Please choose a name for this collector longer than two characters")
}
if(prefix.length > 4){
    throw new Error("Please choose a log prefix for this collector less than four characters")
}
if(!isNaN(parseInt(name.charAt(0), 10))){
    throw new Error("Please ensure the first character of the collector name is not a number")
}

//The different cases of the name
const type = name.toLowerCase().replace(/[\W]+/, "")
const Type = type.charAt(0).toUpperCase() + type.slice(1)
const TYPE = prefix.toUpperCase().replace(/[\W]+/, "")
const date = new Date()
const year = date.getFullYear()

const collectDir = './collectors/' + type

if (!fs.existsSync(collectDir)){
    fs.mkdirSync(collectDir)
} else{
    throw new Error("collector name already exists")
}

//read temp directory
const templateDir = './collectors/template'
copyFiles(templateDir, collectDir)
console.log('populating writing cloud formation template')
const fileContents = fs.readFileSync('collectors/template/cfn/collector.template.template', 'utf8')
const replacedContents = populateTemplate(fileContents)
const templatePath = collectDir + `/cfn/${type}_collector.template`
fs.writeFileSync(templatePath, replacedContents, {'encoding': 'utf8'})

console.log("--------------------------------------")
console.log(`Successfully created ${Type} collector type in ${collectDir}`)

// Recursively populate and copy files
function copyFiles(path, dir){
    const files = fs.readdirSync(path)

    // Populate values in template files and copy others
    files.forEach((file) => {
        const srcPath = `${path}/${file}`

        // If the file object is a directory, recrus and start pupulating files inside
        if(fs.lstatSync(srcPath).isDirectory()){
            const newPath = `${dir}/${file}`
            fs.mkdirSync(newPath)
            copyFiles(srcPath, newPath)
            return
        }

        var destPath
        //if the template file is either collector, test, or mock, add the collector type to the path.
        if(['collector', 'test', 'mock'].some(e => file.match(e))){
            destPath = `${dir}/${type}_${file.replace(/\.template/, '')}`
        // special case for collector.json
        } if(['collector.json'].some(e => file.match(e))){
            destPath = `${dir}/al-${type}-${file.replace(/\.template/, '')}`
        } else{
            destPath = `${dir}/${file.replace(/\.template/, '')}`
        }

        if(file.match(/\.template/)){
            const fileContents = fs.readFileSync(srcPath, 'utf8')
            const replacedContents = populateTemplate(fileContents)
            fs.writeFileSync(destPath, replacedContents, {'encoding': 'utf8'})
            console.log(`populating and copying file ${destPath}`)
        }else{
            fs.copyFileSync(srcPath, destPath)
            console.log(`copying file ${destPath}`)
        }
    });
}

function populateTemplate(fileContents){
    // Replace all of the template values with real values
    return fileContents.replace(/\{\{\s*type\s*\}\}/g, type)
        .replace(/\{\{\s*Type\s*\}\}/g, Type)
        .replace(/\{\{\s*TYPE\s*\}\}/g, TYPE)
        .replace(/\{\{\s*year\s*\}\}/g, year)
        .replace(/\{\{\s*version\s*\}\}/g, version)
}
