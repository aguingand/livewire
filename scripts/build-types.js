let fs = require('fs')
let path = require('path')
let { execSync } = require('child_process')

fs.rmSync(path.resolve(__dirname, '../types'), { recursive: true, force: true })

execSync('npx tsc && npx tsc-alias', { stdio: 'inherit' });

let indexDtsPath = path.resolve(__dirname, '../types/index.d.ts')
let indexDtsContent = fs.readFileSync(indexDtsPath, 'utf8')

if(!indexDtsContent.includes('from "alpinejs"')) {
    indexDtsContent = '// @ts-ignore\nimport Alpine from "alpinejs"\n'+indexDtsContent;
    fs.writeFileSync(indexDtsPath, indexDtsContent);
}

let distDtsPath = path.resolve(__dirname, '../dist/livewire.esm.d.ts')
fs.copyFileSync(indexDtsPath, distDtsPath)

let distDtsContent = fs.readFileSync(distDtsPath, 'utf8')
distDtsContent = distDtsContent.replaceAll('./', '../types/')
fs.writeFileSync(distDtsPath, distDtsContent)

// remove unneeded directories
fs.rmSync(path.resolve(__dirname, '../types/directives'), { recursive: true, force: true })
fs.rmSync(path.resolve(__dirname, '../types/plugins'), { recursive: true, force: true })
fs.rmSync(path.resolve(__dirname, '../types/utils'), { recursive: true, force: true })
