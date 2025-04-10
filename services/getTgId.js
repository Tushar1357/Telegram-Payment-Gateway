const User = require("../database/models/users/User.js")

const getTgId = async (tgName) => {
  try{
    const user = await User.findAll({
      where: {
        tgName
      }
    })
    if (user.length === 0){
      return "No user found with tg name"
    }

    let message = "";
    for (const names of user){
      message += `${names.tgName} - \`${names.tgId}\`\n`
    }
    return message;
  } 
  catch(error){
    console.log("Error while getting tg name",error?.message)
    return "Error while getting tg name."
  }
}

module.exports = getTgId;