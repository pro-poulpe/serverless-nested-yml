[![NPM](https://img.shields.io/npm/v/serverless-nested-yml.svg)](https://www.npmjs.com/package/serverless-nested-yml)
[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com)
[![MIT licensed](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/hyperium/hyper/master/LICENSE)

# Serverless Nested Yml

This plugin help to tiddy your project by splitting your yaml file by sub directory.
It then merge all the globed files in to one configuration.

## Install
This plugin only works for Serverless 1.0 and up. And require `node >= 8` to work properly
 
`npm install serverless-nested-yml --save-dev`

Next, add the serverless-nested-yml plugin in to serverless.yml file: If you don't already have a plugins section, create one that looks like this:

```
plugins:
  - serverless-nested-yml
```

To verify that the plugin was added successfully, run this in your command line:

serverless
The plugin should show up in the "Plugins" section of the output as "ServerlessNestedYml"

## Usage
In your main serverless.yml file you should define the common properties used by all your functions.

> configure
```
custom:
  nestedYml:
    filename: // Filename to search | optional, string - default *serverless.yml
    paths:    // Path to search | optional, string | array - default ['src']
    exclude:  // Path to exclude from search | optional, string | array - default []
```

> project structure

```
<root>
- serverless.yml
- src
    - service1
      - handler.js
      - serverless.yml
    - service2
      - handler.js
      - serverless.yml
```

> main serverless.yml
```

service: myService

plugins:
  - serverless-nested-yml
  
provider:
  name: aws
  runtime: nodejs8.10
  stage: staging
  region: eu-west-1
```

> service 1 serverless.yml

`! headup ! The handler path is always based on the root project.`

```
functions:
  myFunction:
    handler: src/service1/handler.handler
    events:
      - http:
          method: get
          path: /
```

## Contribute
Help us making this plugin better and future proof.

* Clone the code
* Install the dependencies with npm install
* Create a feature branch git checkout -b new_feature
* Lint with standard npm run lint

## License
This software is released under the MIT license. See [the license file](LICENSE) for more details.
