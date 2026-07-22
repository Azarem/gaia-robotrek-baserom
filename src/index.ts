import { DbBlock, DbFile, DbGroup, DbStringType, DbStruct, CopDef, DbFileType } from '@gaialabs/core';
import { DbRootUtils } from '@gaialabs/core';
import type { DbAddressingMode, DbConfig, DbGameRomModule } from '@gaialabs/core';
import { snes } from '@gaialabs/core';

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

import configJP from '../jp/config.json' with { type: 'json' };
import blocksJP from '../jp/blocks.json' with { type: 'json' };
import copdefJP from '../us/copdef.json' with { type: 'json' };
import filesJP from '../jp/files.json' with { type: 'json' };
import groupsJP from '../jp/groups.json' with { type: 'json' };
import labelsJP from '../jp/labels.json' with { type: 'json' };
import mnemonicsJP from '../us/mnemonics.json' with { type: 'json' };
import overridesJP from '../jp/overrides.json' with { type: 'json' };
import rewritesJP from '../jp/rewrites.json' with { type: 'json' };
import stringsJP from '../jp/stringTypes.json' with { type: 'json' };
import structsJP from '../jp/structs.json' with { type: 'json' };
import transformsJP from '../jp/transforms.json' with { type: 'json' };
import fileTypesJP from '../us/fileTypes.json' with { type: 'json' };

export const db : DbGameRomModule = {
    mnemonics,
    overrides: overrides as unknown as Record<string, Record<string, number>>,
    rewrites,
    blocks: blocks as unknown as Record<string, Record<string, Partial<DbBlock>>>,
    copdef: copdef as unknown as Record<string, Partial<CopDef>>,
    files: files as unknown as Record<string, Record<string, Record<string, Partial<DbFile>>>>,
    groups: groups as unknown as Record<string, Partial<DbGroup>>,
    labels, //: labels as unknown as Record<string, string>,
    strings: strings as unknown as Record<string, Partial<DbStringType>>,
    structs: structs as unknown as Record<string, DbStruct>,
    transforms,
    config: config as unknown as DbConfig,
    fileTypes: fileTypes as unknown as Record<string, Partial<DbFileType>>,
    addrModes: snes.addressingModes as unknown as Record<string, Partial<DbAddressingMode>>,
    headers: snes.headers
};

export const jp : DbGameRomModule = {
    mnemonics: mnemonicsJP,
    overrides: overridesJP as unknown as Record<string, Record<string, number>>,
    rewrites: rewritesJP,
    blocks: blocksJP as unknown as Record<string, Record<string, Partial<DbBlock>>>,
    copdef: copdefJP as unknown as Record<string, Partial<CopDef>>,
    files: filesJP as unknown as Record<string, Record<string, Record<string, Partial<DbFile>>>>,
    groups: groupsJP as unknown as Record<string, Partial<DbGroup>>,
    labels: labelsJP, // as unknown as Record<number, string>,
    strings: stringsJP as unknown as Record<string, Partial<DbStringType>>,
    structs: { ...structs, ...structsJP } as unknown as Record<string, DbStruct>,
    transforms: transformsJP,
    config: configJP as unknown as DbConfig,
    fileTypes: fileTypesJP as unknown as Record<string, Partial<DbFileType>>,
    addrModes: snes.addressingModes as unknown as Record<string, Partial<DbAddressingMode>>,
    headers: snes.headers
};

export async function extract(romPath: string, outPath: string) {
    if(!outPath) outPath = './extracted';

    var dbRoot = DbRootUtils.fromGameModule(db);

    await DbRootUtils.extractAllContent(dbRoot, romPath, outPath);
}

export async function extractJP(romPath: string, outPath: string) {
    if(!outPath) outPath = './extracted-jp';

    var dbRoot = DbRootUtils.fromGameModule(jp);

    await DbRootUtils.extractAllContent(dbRoot, romPath, outPath);
}

export async function rebuild(inPath: string, outPath: string, baseRomPath: string) {
    if(!inPath) inPath = './extracted';
    if(!outPath) outPath = './rebuilt';
    if(!baseRomPath) baseRomPath = './baserom';
    
    var dbRoot = DbRootUtils.fromGameModule(db);

    await DbRootUtils.rebuildAllContent(dbRoot, [inPath, baseRomPath], `${outPath}/GaiaLabs.smc`);
}

export async function rebuildJp(inPath: string, outPath: string, baseRomPath: string) {
    if(!inPath) inPath = './extracted-jp';
    if(!outPath) outPath = './rebuilt-jp';
    if(!baseRomPath) baseRomPath = './baserom-jp';
    
    var dbRoot = DbRootUtils.fromGameModule(db);

    await DbRootUtils.rebuildAllContent(dbRoot, [inPath, baseRomPath], `${outPath}/GaiaLabs.smc`);
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
                    console.log('Output Path:', args[1] || '../extracted-jp');
                    await extractJP(args[0], args[1]);
                    console.log('ROM extraction completed successfully!');
                    break;
                case 'rebuild':
                    console.log('Starting ROM rebuild...');
                    await rebuild(args[0], args[1], args[2]);
                    console.log('ROM rebuild completed successfully!');
                    break;
                case 'rebuild-jp':
                    console.log('Starting JP ROM rebuild...');
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
