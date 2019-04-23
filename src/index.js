'use strict'

const BbPromise = require('bluebird')
const { mergeWith, pick, isArray } = require('lodash')
const YAML = require('js-yaml')
const fg = require('fast-glob')

const defaults = {
  filename: '*serverless.yml',
  paths: ['src'],
  exclude: []
}

/**
 * A serverless plugin usefull in splitting your serverless.yml in multiple parts
 */
class ServerlessNestedYml {
  constructor (serverless) {
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
  _setConfig () {
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
  _init () {
    this.commands = {
      'nested-yml': {
        usage: 'Show merged serverless.yml config',
        lifecycleEvents: ['show']
      }
    }

    this.hooks = {
      'nested-yml:show': this.showConfig.bind(this)
    }

    return this._mergeConfig()
  }

  /**
   * fetch all nested yml config files and merge them in the config
   *
   * @returns {Bluebird<void>}
   * @private
   */
  _mergeConfig () {
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
      .map(this.serverless.utils.readFileSync)
      .forEach(file => {
        this.serverless.service = mergeWith(
          this.serverless.service,
          file,
          function customizer (objValue, srcValue) {
            if (isArray(objValue)) {
              return objValue.concat(srcValue)
            }
          })
      })

    return this._reInitServerless()
  }

  /**
   * from serverless run methods
   *
   * @returns {PromiseLike<T | never> | Promise<T | never>|*}
   * @private
   */
  _reInitServerless () {
    this.serverless.utils.logStat(this.serverless).catch(() => BbPromise.resolve())

    if (this.serverless.cli.displayHelp(this.serverless.processedInput)) {
      return BbPromise.resolve()
    }
    this.serverless.cli.suppressLogIfPrintCommand(this.serverless.processedInput)

    // make sure the command exists before doing anything else
    this.serverless.pluginManager.validateCommand(this.serverless.processedInput.commands)

    // populate variables after --help, otherwise help may fail to print
    // (https://github.com/serverless/serverless/issues/2041)
    return this.serverless.variables.populateService(this.serverless.pluginManager.cliOptions)
      .then(() => {
        // merge arrays after variables have been populated
        // (https://github.com/serverless/serverless/issues/3511)
        this.serverless.service.mergeArrays()

        // populate function names after variables are loaded in case functions were externalized
        // (https://github.com/serverless/serverless/issues/2997)
        this.serverless.service.setFunctionNames(this.serverless.processedInput.options)

        // validate the service configuration, now that variables are loaded
        this.serverless.service.validate()
      })
  }

  /**
   * Show included / excluded files in console
   *
   * @param files
   * @param excludes
   * @private
   */
  _showIncludedFiles ({ files, excludes }) {
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
  showConfig () {
    return this._mergeConfig()
      .then(() => {
        const config = pick(this.serverless.service, [
          'custom',
          'functions',
          'package',
          'provider',
          'resources',
          'service'
        ])

        this.serverless.cli.log('Effective serverless.yml:\n' + YAML.dump(config))

        return BbPromise.resolve()
      })
  }
}

module.exports = ServerlessNestedYml
