const ok  = (res, data={}, message='Success', code=200) =>
  res.status(code).json({ success:true,  message, data,   timestamp: new Date().toISOString() });
const err = (res, message='Error', code=400, errors=null) =>
  res.status(code).json({ success:false, message, errors, timestamp: new Date().toISOString() });
module.exports = { ok, err };
