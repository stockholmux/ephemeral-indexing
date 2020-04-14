const
  generatedUsers  = require('./users.json');

const userIndex = generatedUsers.data.map(
  (pair) => {
    const toReturn = {};

    for (let i = 0; i < pair.length; i += 1) {
      toReturn[generatedUsers.cols[i]] = pair[i];
    }
    return toReturn;
  }
);
const usersByEmail = userIndex.reduce((acc,cur,idx,src) => {
  acc[cur[generatedUsers.cols[0]]] = cur;
  return acc;
},{});
module.exports = {
  get   : (email) => usersByEmail[email],
  list  : (start,end) => userIndex.slice(start,end)
};