// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: process.env.Env })
const db = cloud.database()
const _ = db.command
const dateUtils = require('date-utils')


// 云函数入口函数
exports.main = async (event, context) => {
  switch (event.action) {
    case 'addSign': {
      return addSign(event)
    }
    case 'getSignedDetail': {
      return getSignedDetail(event)
    }
    case 'addPoints':{
      return addPoints(event)
    }
    default: break
  }
}

/**
 * 新增签到
 * @param {} event 
 */
async function addSign(event) {

  console.info("addSign")

  try {
    let memberInfos = await db.collection('mini_member').where({
      openId: event.info.openId
    }).get();

    const tasks = []
    let pointCount = 1
    let date = new Date().toFormat("YYYY-MM-DD")
    if (memberInfos.data.length === 0) {
      let task1 = db.collection('mini_member').add({
        data: {
          openId: event.info.openId,
          totalSignedCount: 1,//累计签到数
          continueSignedCount: 1,//持续签到
          totalPoints: 1,//积分
          lastSignedDate: date,//最后一次签到日期
          level: 1,//会员等级（预留）
          unreadMessgeCount: 0,//未读消息（预留）
          modifyTime: new Date().getTime()
        }
      })
      tasks.push(task1)
    }
    else {
      let continueSignedCount = 1
      pointCount = continueSignedCount
      let memberInfo = memberInfos.data[0]
      if (new Date().addDays(-1).toFormat("YYYY-MM-DD") == memberInfo.lastSignedDate) {
        continueSignedCount = memberInfo.continueSignedCount + 1
      }

      if (continueSignedCount > 30) {
        pointCount = 30
      }

      let task2 = db.collection('mini_member').doc(memberInfo._id).update({
        data: {
          totalSignedCount: _.inc(1),
          continueSignedCount: continueSignedCount,
          totalPoints: _.inc(pointCount),
          lastSignedDate: date,
          modifyTime: new Date().getTime()
        }
      });
      tasks.push(task2)
    }

    //签到明细
    let date1 = new Date().toFormat("YYYY-M-D").split("-")
    let task3 = db.collection('mini_sign_detail').add({
      data: {
        openId: event.info.openId,
        year: date1[0],
        month: date1[1],
        day: date1[2],
        createTime: new Date().getTime()
      }
    })
    tasks.push(task3)

    //如果统一订阅签到通知
    if (event.info.accept == 'accept') {
      let task4 = await db.collection("mini_subcribute").add({
        data: {
          templateId: event.info.templateId,
          openId: event.info.openId,
          timestamp: new Date().getTime()
        }
      });
      tasks.push(task4)
    }

    //积分明细
    let task5 = db.collection('mini_point_detail').add({
      data: {
        openId: event.info.openId,
        operateType: 0,//0:获得 1:使用 2:过期
        count: pointCount,
        desc: "签到得积分",
        date: (new Date()).toFormat("YYYY-MM-DD HH:MI:SS"),
        createTime: new Date().getTime()
      }
    })
    tasks.push(task5)
    await Promise.all(tasks)
    return true
  }
  catch (e) {
    console.error(e)
    return false
  }
}

/**
 * 获取签到明细
 * @param {}  
 */
async function getSignedDetail(event) {

  const wxContext = cloud.getWXContext()
  console.info(event)
  let res = await db.collection('mini_sign_detail')
    .where({
      openId: wxContext.OPENID,
      year: event.year,
      month: event.month
    })
    .limit(100)
    .get()
  return res.data
}

/**
 * 新增积分
 * @param {} event 
 */
async function addPoints(event) {
  console.info("addPoints")
  try {
    const wxContext = cloud.getWXContext()
    const tasks = []
    let pointCount = 0;
    let desc = ""

    switch (event.taskType) {
      case 'taskVideo': {
        pointCount = 50
        desc = "完成观看视频任务奖励"
      }
      case 'taskRead': {
        pointCount = 1
        desc = "阅读文章奖励"
      }
      default: break
    }

    let memberInfos = await db.collection('mini_member').where({
      openId: wxContext.OPENID
    }).get();

    if (memberInfos.data.length === 0) {
      let task1 = db.collection('mini_member').add({
        data: {
          openId: wxContext.OPENID,
          totalSignedCount: 0,//累计签到数
          continueSignedCount: 0,//持续签到
          totalPoints: pointCount,//积分
          lastSignedDate: '',//最后一次签到日期
          level: 1,//会员等级（预留）
          unreadMessgeCount: 0,//未读消息（预留）
          modifyTime: new Date().getTime()
        }
      })
      tasks.push(task1)
    }
    else {

      let memberInfo = memberInfos.data[0]
      let task2 = db.collection('mini_member').doc(memberInfo._id).update({
        data: {
          totalPoints: _.inc(pointCount),
          modifyTime: new Date().getTime()
        }
      });
      tasks.push(task2)
    }

    //积分明细
    let task3 = db.collection('mini_point_detail').add({
      data: {
        openId: wxContext.OPENID,
        operateType: 0,//0:获得 1:使用 2:过期
        count: pointCount,
        desc: "完成观看视频任务奖励",
        date: (new Date()).toFormat("YYYY-MM-DD HH:MI:SS"),
        createTime: new Date().getTime()
      }
    })
    tasks.push(task3)
    await Promise.all(tasks)
    return true
  }
  catch (e) {
    console.error(e)
    return false
  }
}