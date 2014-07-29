var today = new Date();

var tomorrow = new Date(+new Date() + 24 * 60 * 60 * 1000);
console.log(tomorrow);

$("#datetimepicker").datetimepicker({
  pickerPosition: 'bottom-left',
  todayBtn: true,
  format: "dd.mm.yyyy hh:00",
  minView: 1,
  weekStart: 1,
  startDate: new Date()
});

console.log($("#datetimepicker").data('datetimepicker'));

console.log(today);

