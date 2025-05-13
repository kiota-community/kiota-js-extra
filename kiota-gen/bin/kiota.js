#! /usr/bin/env node

// ----------------------------------------------------------------------------
// The following ENV variables can be used to control this tool:
//
// KIOTA_VERSION       | The version of Kiota to use.                 | Default: 'latest'
// KIOTA_DOWNLOAD_URL  | Where to download Kiota from.                | Default: 'https://github.com/microsoft/kiota/releases/download'
// KIOTA_DOWNLOAD_DIR  | Where to download Kiota to.                  | Default: './.kiota'
// KIOTA_BINARY        | Path to an existing installation of Kiota.   | Default: '~/kiota'
// ----------------------------------------------------------------------------


// --------------------------------
// Define some constants
// --------------------------------
const DEFAULT_KIOTA_VERSION = "latest";
const KIOTA_LATEST_RELEASE_URL= "https://api.github.com/repos/microsoft/kiota/releases/latest";
// Note: GitHub API requires a user-agent or it will return a 403.
// The 'https' function of 'follow-redirects' does not send one by default.
const GITHUB_REQUEST_OPTIONS = {
    headers: {
        "User-Agent": "node.js/*.*",
    }
};
let KIOTA_DOWNLOAD_URL = process.env["KIOTA_DOWNLOAD_URL"];
let KIOTA_DOWNLOAD_DIR = process.env["KIOTA_DOWNLOAD_DIR"];
let KIOTA_BINARY = process.env["KIOTA_BINARY"];

// If the configured URL ends with a "/", strip it out.
if (KIOTA_DOWNLOAD_URL !== undefined && KIOTA_DOWNLOAD_URL !== null && KIOTA_DOWNLOAD_URL.endsWith("/")) {
    KIOTA_DOWNLOAD_URL = KIOTA_DOWNLOAD_URL.substring(0, KIOTA_DOWNLOAD_URL.length - 1);
}

// --------------------------------
// Imports from dependencies
// --------------------------------
const followRedirects = require("follow-redirects");
const { https } = followRedirects;
const fs = require("fs");
const url = require("url");
const path = require("path");
const decompress = require("decompress");
const shell = require("shelljs");

// --------------------------------
// Extract configuration from env
// --------------------------------
const platform = process.platform;
const architecture = process.arch;

if (KIOTA_DOWNLOAD_URL === undefined || KIOTA_DOWNLOAD_URL === "") {
    KIOTA_DOWNLOAD_URL = "https://github.com/microsoft/kiota/releases/download";
}
if (KIOTA_DOWNLOAD_DIR === undefined || KIOTA_DOWNLOAD_DIR === "") {
    KIOTA_DOWNLOAD_DIR = path.join(process.cwd(), '.kiota');
}


/**
 * Gets the latest Kiota release version by using the GitHub API to fetch the
 * most recent release.
 * @returns {Promise<unknown>}
 */
const getLatestKiotaReleaseVersion = async () => {
    return new Promise((resolve, reject) => {
        https.get(KIOTA_LATEST_RELEASE_URL, GITHUB_REQUEST_OPTIONS, (res) => {
            const statusCode = res.statusCode;

            if (statusCode !== 200) {
                const error = new Error(`Request Failed.\nStatus Code: ${statusCode}`);
                console.error(error.message);
                res.resume();
                reject(error);
            } else {
                let body = "";
                res.on("data", (chunk) => {
                    body += chunk;
                });
                res.on("end", () => {
                    try {
                        let json = JSON.parse(body);
                        resolve(json["tag_name"]);
                    } catch (error) {
                        console.error("Error parsing response from GitHub API.");
                        reject(error);
                    }
                });
                res.on("error", (err) => {
                    console.error("Error getting latest Kiota release (using GitHub API).");
                    reject(err);
                });
            }
        });
    });
};

/**
 * Downloads and installs a specific version of Kiota.  Returns the path to
 * the downloaded CLI tool.  If the requested version of Kiota has already
 * been downloaded, it will skip the download and just return the path to
 * the CLI.
 * @param kiotaVersion
 * @param os {"win"|"linux"|"osx"}
 * @param arch {"x64"|"x86"|"arm64"}
 * @returns {Promise<void>}
 */
const downloadAndInstallKiota = async (kiotaVersion, os, arch) => {
    // Create temporary local directory to download/run Kiota CLI from
    const downloadDir = KIOTA_DOWNLOAD_DIR;
    const downloadPath = path.join(downloadDir, `kiota-${kiotaVersion}`);
    const execPath = path.join(downloadDir, `${kiotaVersion}`);
    fs.mkdirSync(execPath, { recursive: true });

    // Path to the Kiota CLI
    const execBinary = path.join(process.cwd(), '.kiota', `${kiotaVersion}`, 'kiota');
    
    if (fs.existsSync(execBinary)) {
        // Kiota was already downloaded and/or installed in the .kiota directory
        console.log(`Kiota binary version ${kiotaVersion} already downloaded at ${downloadPath}`);
        return Promise.resolve(execBinary);
    
    } else if (os === "win") { 
        // https://github.com/kiota-community/kiota-js-extra/issues/12
        const winOnlyExecBinary = `${execBinary}.exe`;
        if (fs.existsSync(winOnlyExecBinary)) {
            console.log(`Kiota binary version ${kiotaVersion} already downloaded at ${downloadPath}`);
            return Promise.resolve(winOnlyExecBinary);
        }
    }

    return new Promise((resolve, reject) => {
        const kiotaUrl = `${KIOTA_DOWNLOAD_URL}/${kiotaVersion}/${os}-${arch}.zip`;

        if (kiotaUrl.startsWith("file:")) {
            const sourcePath = url.fileURLToPath(kiotaUrl);
            console.log(`Copying Kiota binary from ${sourcePath}`);
            if (!fs.existsSync(sourcePath)) {
                const error = new Error(`File not found: ${sourcePath}`);
                console.error(error.message);
                reject(error);
            } else {
                fs.promises.copyFile(sourcePath, downloadPath).then(() => {
                    decompress(downloadPath, execPath)
                        .then(() => {
                            resolve(execBinary);
                        })
                        .catch((error) => {
                            reject(error);
                        });
                }).catch((error) => {
                    reject(error);
                });
            }
        } else {
            console.log(`Downloading Kiota binary from ${kiotaUrl}`);
            https.get(kiotaUrl, GITHUB_REQUEST_OPTIONS, (res) => {
                const statusCode = res.statusCode;
                if (statusCode !== 200) {
                    const error = new Error(`Request Failed.\nStatus Code: ${statusCode}`);
                    console.error(error.message);
                    res.resume();
                    reject(error);
                } else {
                    const writeStream = fs.createWriteStream(downloadPath);
                    res.pipe(writeStream);
                    writeStream.on("finish", () => {
                        console.log(`Kiota binary version ${kiotaVersion} downloaded at ${downloadPath}`);
                        decompress(downloadPath, execPath)
                            .then(() => {
                                resolve(execBinary);
                            })
                            .catch((error) => {
                                reject(error);
                            });
                    });
                    writeStream.on("error", (err) => {
                        console.error(`Failed to write Kiota binary version ${kiotaVersion} to ${downloadPath}: ${err.message}`);
                        reject(err);
                    });
                }
            });
        }
    });
};

/**
 * Wraps the 'kiota' command line tool, passing it the arguments provided to this
 * function.  This function will download the given version of Kiota locally and
 * then call it.
 * @param kiotaVersion
 * @param args
 * @returns {Promise<number>}
 */
const kiota = async (kiotaVersion, args) => {
    let os = ''
    if (platform === 'win32') {
        os = 'win';
    } else if (platform === 'linux') {
        os = 'linux';
    } else if (platform === 'darwin') {
        os = 'osx';
    } else {
        throw new Error(`Unsupported platform: ${platform}`);
    }

    let arch = '';
    if (architecture === 'x64') {
        arch = 'x64';
    } else if (architecture === 'x86') {
        arch = 'x86';
    } else if (architecture === 'arm64') {
        arch = 'arm64'
    } else {
        throw new Error(`Unsupported architecture: ${architecture}`);
    }

    let kiotaCmd = '';
    if(KIOTA_BINARY !== undefined && KIOTA_BINARY !== "") {
        kiotaCmd = KIOTA_BINARY;
        kiotaVersion = await new Promise((resolve, reject) => {
            shell.exec(KIOTA_BINARY + " --version", { silent: true }, (code, stdout, stderr) => {
                if (code > 0) {
                    reject(new Error("Kiota failed."));
                } else {
                    resolve(stdout.trim());
                }
            });
        });  
    } else {
        kiotaCmd = await downloadAndInstallKiota(kiotaVersion, os, arch);
    }
    
    console.log(`---`)
    console.log(`Executing Kiota CLI using:`)
    console.log(`    Kiota version: ${kiotaVersion}`)
    console.log(`    Platform: ${os}`)
    console.log(`    Architecture: ${arch}`)
    console.log(`---`)

    const kiotaCmdWithArgs = `"${kiotaCmd}" ${args.join(" ")}`;

    console.log(kiotaCmdWithArgs);

    // Now execute Kiota with the arguments passed in.
    return new Promise((resolve, reject) => {
        shell.exec(kiotaCmdWithArgs, (code, stdout, stderr) => {
            if (code > 0) {
                reject(new Error("Kiota failed."));
            } else {
                console.log("-------------------------------------------");
                console.log("Kiota CLI execution completed successfully.");
                console.log("-------------------------------------------");
                resolve(0);
            }
        });
    });
};

/**
 * Main function.
 * @param args
 * @returns {Promise<number>}
 */
const main = async (...args) => {
    let kiotaVersion = process.env["KIOTA_VERSION"] || DEFAULT_KIOTA_VERSION;
    if (kiotaVersion === undefined || kiotaVersion === "" || kiotaVersion === "latest") {
        kiotaVersion = await getLatestKiotaReleaseVersion();
    }
    return await kiota(kiotaVersion, args);
};

// Extract the args from the process and invoke the main function.
const args = process.argv.slice(2)
main(...args).then(
    code => process.exit(code),
    er => {
        console.error(er);
        process.exit(1);
    }
);
