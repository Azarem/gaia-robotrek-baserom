import { DbBlock, DbFile, DbGroup, DbStringType, DbStruct, DbAddressingMode, CopDef, BlockWriter, DbFileType } from '@gaialabs/core';
import { readFileAsBinary, DbRootUtils, BlockReader, saveFileAsText, saveFileAsBinary } from '@gaialabs/core';
import type { DbConfig, DbGameRomModule } from '@gaialabs/core';

import config from '../us/config.json' with { type: 'json' };
import blocks from '../us/blocks.json' with { type: 'json' };
import copdef from '../us/copdef.json' with { type: 'json' };
import files from '../us/files.json' with { type: 'json' };
import groups from '../us/groups.json' with { type: 'json' };
import labels from '../us/labels.json' with { type: 'json' };
import mnemonics from '../us/mnemonics.json' with { type: 'json' };
import overrides from '../us/overrides.json' with { type: 'json' };
import rewrites from '../us/rewrites.json' with { type: 'json' };
import strings from '../us/stringTypes.json' with { type: 'json' };
import structs from '../us/structs.json' with { type: 'json' };
import transforms from '../us/transforms.json' with { type: 'json' };
import fileTypes from '../us/fileTypes.json' with { type: 'json' };


import addrModes from '../snes/addressingModes.json' with { type: 'json' };

export const db : DbGameRomModule = {
    mnemonics,
    overrides: overrides as unknown as Record<string, Record<string, number>>,
    rewrites,
    blocks: blocks as unknown as Record<string, Record<string, Partial<DbBlock>>>,
    copdef: copdef as unknown as Record<string, Partial<CopDef>>,
    files: files as unknown as Record<string, Record<string, Record<string, Partial<DbFile>>>>,
    groups: groups as unknown as Record<string, Partial<DbGroup>>,
    labels,
    strings: strings as unknown as Record<string, Partial<DbStringType>>,
    structs: structs as unknown as Record<string, DbStruct>,
    transforms,
    config: config as unknown as DbConfig,
    addrModes: addrModes as unknown as Record<string, Partial<DbAddressingMode>>,
    fileTypes: fileTypes as unknown as Record<string, Partial<DbFileType>>,
    //neutrals: []
};

export async function extract(romPath: string, outPath: string) {
    if(!outPath) outPath = './extracted';

    var dbRoot = DbRootUtils.fromGameModule(db);

    await DbRootUtils.extractAllContent(dbRoot, romPath, outPath);
}

export async function rebuild(inPath: string, outPath: string, baseRomPath: string) {
    if(!inPath) inPath = './extracted';
    if(!outPath) outPath = './rebuilt';
    if(!baseRomPath) baseRomPath = './baserom';
    
    var dbRoot = DbRootUtils.fromGameModule(db);

    await DbRootUtils.rebuildAllContent(dbRoot, [inPath, baseRomPath], `${outPath}/GaiaLabs-Blazer.smc`);
}

// CLI handler - only execute when run directly (not when imported as a module)
// Check if this module is being run directly
const isMainModule = process.argv[1]?.includes('index.ts') || process.argv[1]?.includes('index.js');

if (isMainModule) {
    const command = process.argv[2];
    const args = process.argv.slice(3);

    (async () => {
        try {
            switch (command) {
                case 'extract':
                    console.log('Starting ROM extraction...');
                    console.log('ROM Path:', args[0]);
                    console.log('Output Path:', args[1] || '../extracted');
                    await extract(args[0], args[1]);
                    console.log('ROM extraction completed successfully!');
                    break;
                case 'extract-jp':
                    console.log('Starting ROM extraction...');
                    console.log('ROM Path:', args[0]);
                    console.log('Output Path:', args[1] || '../extracted');
                    await extractJP(args[0], args[1]);
                    console.log('ROM extraction completed successfully!');
                    break;
                case 'rebuild':
                    console.log('Starting ROM rebuild...');
                    await rebuild(args[0], args[1], args[2]);
                    console.log('ROM rebuild completed successfully!');
                    break;
                default:
                    console.error('Unknown command:', command);
                    console.log('Available commands: extractRom, rebuildRom');
                    process.exit(1);
            }
        } catch (error) {
            console.error('Error:', error);
            process.exit(1);
        }
    })();
}
