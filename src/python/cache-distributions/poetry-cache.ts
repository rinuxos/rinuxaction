import * as glob from '@actions/glob';
import * as io from '@actions/io';
import * as path from 'path';
import * as exec from '@actions/exec';
import * as core from '@actions/core';

import CacheDistributor from './cache-distributor';
import {logWarning} from '../../utils/utils';

class PoetryCache extends CacheDistributor {
  constructor(
    private pythonVersion: string,
    protected patterns: string = '**/poetry.lock'
  ) {
    super('poetry', patterns);
  }

  protected async getCacheGlobalDirectories() {
    const poetryConfig = await this.getPoetryConfiguration();

    const cacheDir = poetryConfig['cache-dir'];
    const virtualenvsPath = poetryConfig['virtualenvs.path'].replace(
      '{cache-dir}',
      cacheDir
    );

    const paths = [virtualenvsPath];

    if (poetryConfig['virtualenvs.in-project'] === true) {
      paths.push(path.join(process.cwd(), '.venv'));
    }

    const pythonLocation = await io.which('python');

    if (pythonLocation) {
      core.debug(`pythonLocation is ${pythonLocation}`);
      const {
        exitCode,
        stderr
      } = await exec.getExecOutput(
        `poetry env use ${pythonLocation}`,
        undefined,
        {ignoreReturnCode: true}
      );

      if (exitCode) {
        logWarning(stderr);
      }
    } else {
      logWarning('python binaries were not found in PATH');
    }

    return paths;
  }

  protected async computeKeys() {
    const hash = await glob.hashFiles(this.patterns);
    const primaryKey = `${this.CACHE_KEY_PREFIX}-${process.env['RUNNER_OS']}-python-${this.pythonVersion}-${this.packageManager}-${hash}`;
    const restoreKey: any = undefined;
    return {
      primaryKey,
      restoreKey
    };
  }

  private async getPoetryConfiguration() {
    const {stdout, stderr, exitCode} = await exec.getExecOutput('poetry', [
      'config',
      '--list'
    ]);

    if (exitCode && stderr) {
      throw new Error(
        'Could not get cache folder path for poetry package manager'
      );
    }

    const lines = stdout.trim().split('\n');

    const config: any = {};

    for (let line of lines) {
      line = line.replace(/#.*$/gm, '');

      const [key, value] = line.split('=').map(part => part.trim());

      config[key] = JSON.parse(value);
    }

    return config as {
      'cache-dir': string;
      'virtualenvs.in-project': boolean;
      'virtualenvs.path': string;
    };
  }
}

export default PoetryCache;