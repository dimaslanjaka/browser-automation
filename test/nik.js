import region_controller from 'nik-parser-jurusid';

const nik = '1509120703930001';
const result = region_controller.nikParser(nik);
console.log(region_controller.nikParser('3174084509980002'));
console.log(result);
