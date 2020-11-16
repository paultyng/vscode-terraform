import * as vscode from 'vscode';
import * as del from 'del';
import * as fs from 'fs';
import * as semver from 'semver';

import { exec } from './utils';
import { Release, getRelease } from '@hashicorp/js-releases';

export class LanguageServerInstaller {
	public async install(directory: string): Promise<void> {
		const { version: extensionVersion } = require('../package.json');
		const lspCmd = `${directory}/terraform-ls --version`;
		const userAgent = `Terraform-VSCode/${extensionVersion} VSCode/${vscode.version}`;
		let isInstalled = true;
		try {
			var { stderr: installedVersion } = await exec(lspCmd);
		} catch (err) {
			// TODO: verify error was in fact binary not found
			isInstalled = false;
		}
		const currentRelease = await getRelease("terraform-ls", "latest", userAgent);
		if (isInstalled) {
			if (semver.gt(currentRelease.version, installedVersion, { includePrerelease: true })) {
				const selected = await vscode.window.showInformationMessage(`A new language server release is available: ${currentRelease.version}. Install now?`, 'Install', 'Cancel');
				if (selected === 'Cancel') {
					return;
				}
			} else {
				return;
			}
		}

		try {
			await this.installPkg(currentRelease, directory, userAgent);
		} catch (err) {
			vscode.window.showErrorMessage('Unable to install terraform-ls');
			console.error(err);
			throw err;
		}

		// Do not wait on the showInformationMessage
		vscode.window.showInformationMessage(`Installed terraform-ls ${currentRelease.version}.`, "View Changelog")
			.then(selected => {
				if (selected === "View Changelog") {
					return vscode.env.openExternal(vscode.Uri.parse(`https://github.com/hashicorp/terraform-ls/releases/tag/v${currentRelease.version}`));
				}
			})
	}

	async installPkg(release: Release, installDir: string, userAgent: string): Promise<void> {
		const destination = `${installDir}/terraform-ls_v${release.version}.zip`;
		fs.mkdirSync(installDir, { recursive: true }); // create install directory if missing
	
		let platform = process.platform.toString();
		if (platform === 'win32') {
			platform = 'windows';
		}
		let arch: string;
		switch (process.arch) {
			case 'x64':
				arch = 'amd64'
				break;
			case 'ia32':
				arch = '386'
				break;
		}
		const build = release.getBuild(platform, arch);
		if (!build) {
			throw new Error("Install error: no matching terraform-ls binary for platform");
		}
		try {
			this.removeOldBinary(installDir, platform);
		} catch {
			// ignore missing binary (new install)
		}
	
		return vscode.window.withProgress({
			cancellable: true,
			location: vscode.ProgressLocation.Notification,
			title: "Installing terraform-ls"
		}, async (progress) => {
			progress.report({ increment: 30 });
			await release.download(build.url, destination, userAgent);
			progress.report({ increment: 30 });
			await release.verify(destination, build.filename)
			progress.report({ increment: 30 });
			return release.unpack(installDir, destination)
		});
	}

	removeOldBinary(directory: string, platform: string): void {
		if (platform === "windows") {
			fs.unlinkSync(`${directory}/terraform-ls.exe`);
		} else {
			fs.unlinkSync(`${directory}/terraform-ls`);
		}
	}

	public async cleanupZips(directory: string): Promise<string[]> {
		return del(`${directory}/terraform-ls*.zip`, { force: true });
	}
}
