/**
 * koa2 webpack4 开发服务
 */

const path = require('path') // 解析文件路径
const webpack = require('webpack')  // 读取配置文件进行打包
const MFS = require('memory-fs') // 使用内存文件系统更快，文件生成在内存中而非真实文件

const clientConfig = require('./webpack.client.config.js')
const serverConfig = require('./webpack.server.config.js')

// Open stuff like URLs, files, executables. Cross-platform.
const open = require('open')
const convert = require('koa-convert')
const webpackDevMiddleware = require('koa-webpack-dev-middleware')
const webpackHotMiddleware = require('koa-webpack-hot-middleware')

const readFile = (fs, file) => fs.readFileSync(path.join(clientConfig.output.path, file), 'utf-8')


module.exports = function setupDevServer(app, uri, cb) {
    let bundle
    let template

    const update = () => {
        if (bundle && template) {
            cb(bundle, {
                template,
            })
        }
    }

    // modify client config to work with hot middleware
    clientConfig.entry.app = ['webpack-hot-middleware/client?path=/__webpack_hmr&timeout=2000&reload=true', clientConfig.entry.app]
    // 增加后台热更新
    clientConfig.output.filename = '[name].js'
    clientConfig.plugins.push(
        new webpack.HotModuleReplacementPlugin(),
        new webpack.NoEmitOnErrorsPlugin()
    )

    // 创建webpack实例
    const clientCompiler = webpack(clientConfig)
    // dev middleware
    const devMiddleware = webpackDevMiddleware(clientCompiler, {
        publicPath: clientConfig.output.publicPath,
        noInfo: true,
        headers: { 'Access-Control-Allow-Origin': '*' },
        stats: {
            colors: true,
            modules: false,
        },
    })
    app.use(convert(devMiddleware))
    // hot update
    clientCompiler.plugin('done', stats => {
        const fs = devMiddleware.fileSystem
        stats = stats.toJson()
        stats.errors.forEach(err => console.error(err))
        stats.warnings.forEach(err => console.warn(err))
        if (stats.errors.length) return

        // clientManifest = JSON.parse(readFile(
        //     devMiddleware.fileSystem,
        //     'vue-ssr-client-manifest.json'
        // ))

        let filePath = path.join(clientConfig.output.path, 'index.ssr.html')
        if (fs.existsSync(filePath)) {
            // 读取内存模板
            template = readFile(fs, 'index.ssr.html')
        }
        update()
    })
    // hot middleware
    app.use(convert(webpackHotMiddleware(clientCompiler)))
    // app.use(require('webpack-hot-middleware')(clientCompiler, { heartbeat: 5000 }))


    // watch and update server renderer
    const serverCompiler = webpack(serverConfig)
    const mfs = new MFS()
    serverCompiler.outputFileSystem = mfs
    serverCompiler.watch({}, (err, stats) => {
        if (err) throw err
        stats = stats.toJson()
        if (stats.errors.length) return

        // read bundle generated by vue-ssr-webpack-plugin
        bundle = JSON.parse(readFile(mfs, 'vue-ssr-server-bundle.json'))
        update()
    })

    devMiddleware.waitUntilValid(() => {
        console.log('\n> Listening at ' + uri + '\n')
        open(uri)
    })
}