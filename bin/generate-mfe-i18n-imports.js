#!/usr/bin/env node
const {access, constants, readdir, readFile, unlink, writeFile} = require('fs/promises');

const i18nDir = 'src/i18n';
const messagesDir = `${i18nDir}/messages`;

async function generateDirectoryIndex(directory) {
    console.log('generateDirectoryIndex', directory);

    const importLines = [];

    const messagesLines = [];

    try {
        const files = await readdir(`${messagesDir}/${directory}`, {withFileTypes: true});

        const jsonFiles = files.filter(file => file.isFile() && file.name.endsWith('.json'))

        if (!jsonFiles.length) {
            console.error(`Skipping ${directory} because no .json translation files were found.`);
            return;
        }

        for (const [i, file] of jsonFiles.entries()) {
            const languageCode = file.name.replace(/\.json$/, '');
            const languageCodeDash = languageCode.toLowerCase().replace(/_/g, '-')
            const uniqueMessageVariable = `messages${i}${languageCode}`;
            const filePath = `${messagesDir}/${directory}/${languageCode}.json`

            try {
                const entries = JSON.parse(await readFile(filePath, { encoding: 'utf8' }));

                if (!Object.keys(entries).length) {
                    console.error(`Skipping ${directory}'s ${languageCode} due to empty translation files were found.`);
                    continue;
                }
            } catch (e) {
                console.error(`Skipping ${directory}'s ${languageCode} due to error: ${e}.`);
                continue;
            }

            console.log(languageCode);

            importLines.push(
                `import ${uniqueMessageVariable} from './${languageCode}.json';`
            );

            messagesLines.splice(1, 0, `  '${languageCodeDash}': ${uniqueMessageVariable},`)
        }

        if (importLines.length) {
            const messagesFileContent = [
                '// This file is generated by the Open edX generate-mfe-i18n-imports.',
                '// Refer to docs yada yada ...',
                '//\n',
                importLines.join('\n'),
                'const messages = {',
                messagesLines.join('\n'),
                '};',
                'export default messages;',
                '',
            ].join('\n');

            await writeFile(`${messagesDir}/${directory}/index.js`, messagesFileContent);

            console.log(messagesFileContent)
        } else {
            console.error(`Skipping ${directory} because no languages were found.`);
        }
    } catch (e) {
        console.error(`Skipping ${directory} due to error: ${e}.`);
    }
}

async function generateMainIndex(directories) {
    console.log('generateMainIndex');

    const importLines = [];
    const exportLines = [];

    for (const [i, directory] of directories.entries()) {
        try {
            await access(`${messagesDir}/${directory}/index.js`, constants.R_OK);
            const directoryJsName = directory.replace(/[^a-z]/ig, '');

            const moduleName = `messages${1}${directoryJsName}`;
            importLines.push(`import ${moduleName} from './messages/${directory}';`);
            exportLines.push(`  ${moduleName},`);
        } catch {
            console.error(`Skipping ${directory} because it doesn't have index.js file.`);
        }
    }

    const indexFileContent = [
        '// This file is generated by the Open edX generate-mfe-i18n-imports.',
        '// Refer to docs yada yada ...',
        '//\n',
        importLines.join('\n'),
        '',
        'export default [',
        exportLines.join('\n'),
        '];\n',
    ].join('\n');

    await writeFile(`${i18nDir}/index.js`, indexFileContent);
    try {
        await unlink(`${i18nDir}/index.jsx`);
        console.log('Removed conflicting `index.jsx`')
    } catch (e) {
        console.log(`Did not remove index.jsx: ${e}`)
    }
    console.log(indexFileContent);
}


;(async function main() {
    const directories = process.argv.slice(2)

    for (const directory of directories) {
        await generateDirectoryIndex(directory);
    }
    await generateMainIndex(directories);
}());