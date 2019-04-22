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
    this.done = false

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
   * @returns {ServerlessNestedYml}
   * @private
   */
  _init () {
    this.commands = {
      'child-merge': {
        usage: 'Merge nested serverless.yml',
        lifecycleEvents: ['show']
      }
    }

    this.hooks = {
      'child-merge:show': this.showConfig.bind(this)
    }

    const hookToRegister = [
      'webpack:validate:validate',
      'offline:start'
    ]

    hookToRegister.forEach(name => {
      this.hooks[`before:${name}`] = this._mergeChildConfigFiles.bind(this)
    })

    return this
  }

  /**
   * Wrap the config merge to be called only once
   *
   * @private
   */
  _mergeChildConfigFiles () {
    if (this.done === true) return

    this._mergeConfig()

    this.done = true
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

    return BbPromise.resolve()
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
