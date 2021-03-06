const general = require('../utils/mongo-util')
const { list } = general

const models = require('../mongodb/models')
const AdminModel = models.AdminModel

/**
 * 管理时, 获取文章列表
 * @method
 * @param  {[type]} ctx [description]
 * @return {[type]}     [description]
 */
exports.getList = async ctx => {
  await list(ctx, AdminModel, '-update_date')
}

