'use strict'
const BbPromise = require('bluebird')
const { mergeWith, pick, isArray, get, set } = require('lodash')
const YAML = require('js-yaml')
const fg = require('fast-glob')
const { resolve, dirname, basename, join } = require('path')
const defaults = {
  filename: '*serverless.yml',
  paths: ['src'],
  exclude: [],
  monorepo: false
}
/**
 * A serverless plugin usefull in splitting your serverless.yml in multiple parts
 */
class ServerlessNestedYml {
  constructor(serverless) {
    this.serverless = serverless
    this.config = {}
    this
      ._setConfig()
      ._init()
  }
  /**
   * Get config from custom.splittedYml
   *
   * @returns {ServerlessNestedYml}
   * @private
   */
  _setConfig() {
    const keys = Object.keys(defaults)
    const customConfig = pick(this.serverless.service.custom.nestedYml || {}, keys)
    keys.forEach(key => {
      if (isArray(defaults[key])) {
        this.config[key] = !customConfig[key]
          ? defaults[key]
          : isArray(customConfig[key])
            ? customConfig[key]
            : [customConfig[key]]
      } else {
        this.config[key] = customConfig[key] || defaults[key]
      }
    })
    return this
  }
  /**
   * Initialize commands and hooks
   *
   * @returns {Bluebird<void>}
   * @private
   */
  _init() {
    this.commands = {
      'nested-yml': {
        usage: 'Show merged serverless.yml',
        lifecycleEvents: ['print']
      }
    }
    this.hooks = {
      'nested-yml:print': this.showConfig.bind(this)
    }
    return this._mergeConfig()
  }
  /**
   * fetch all nested yml config files and merge them in the config
   *
   * @returns {Bluebird<void>}
   * @private
   */
  _mergeConfig() {
    const globs = this.config.paths.map(path => (
      `${path}/**/${this.config.filename}`
        .split('/')
        .filter(s => s)
        .join('/')
    ))
    const excludes = this.config.exclude.map(path => (
      '!' + path
        .split('/')
        .filter(s => s)
        .join('/')
    ))
    const files = fg.sync([...globs, ...excludes])
    this._showIncludedFiles({ files, excludes })
    files
      .map(file => {
        return {
          path: file,
          content: this.serverless.utils.readFileSync(file)
        }
      })
      .forEach(({ content, path }) => {

        if (this.config.monorepo === true && content.functions) {
          const modulePath = dirname(path)
          Object.keys(content.functions).forEach(fnName => {
            const formatted = join(modulePath, content.functions[fnName].handler)
            content.functions[fnName].handler = formatted
          })
        }
        this.serverless.service = mergeWith(
          this.serverless.service,
          content,
          (objValue, srcValue, key) => {
            if (key === 'webpackConfig' && this.config.monorepo === true) {
              return objValue;
            }
            if (isArray(objValue)) {
              return objValue.concat(srcValue)
            }
          })
      })
    return BbPromise.resolve()
  }
  /**
   * Show included / excluded files in console
   *
   * @param files
   * @param excludes
   * @private
   */
  _showIncludedFiles({ files, excludes }) {
    console.log()
    this.serverless.cli.log(`${this.constructor.name} - found ${files.length} files`)
    for (const file of files) {
      console.log('  ', file)
    }
    console.log()
    if (excludes.length > 0) {
      this.serverless.cli.log(`${this.constructor.name} - files exclusion`)
      for (const exclude of excludes) {
        console.log('  ', exclude.replace('!', ''))
      }
      console.log()
    }
  }
  /**
   * Like print command but with the merged config
   *
   * @example serverless splitted
   */
  showConfig() {
    return this._mergeConfig()
      .then(() => {
        return this.serverless.variables.populateService(this.serverless.pluginManager.cliOptions)
      })
      .then(() => {
        const config = pick(this.serverless.service, [
          'custom',
          'functions',
          'package',
          'provider',
          'resources',
          'service'
        ])
        this.serverless.cli.log('Merged serverless.yml:\n')
        console.log(YAML.dump(config))
        return BbPromise.resolve()
      })
  }
}
module.exports = ServerlessNestedYml