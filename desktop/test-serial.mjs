// test-serial.mjs
import { SerialPort } from 'serialport';

const port = new SerialPort({
  path: 'COM7',
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  rtscts: false,
  autoOpen: false,
});

port.on('data', (buf) => {
  console.log('GOT DATA:', buf.length, 'bytes');
  console.log('HEX:', buf.toString('hex'));
  console.log('TEXT:', JSON.stringify(buf.toString('utf8')));
});

port.on('error', (err) => console.error('ERROR:', err));

port.open((err) => {
  if (err) return console.error('Open error:', err);
  console.log('Port open');

  // ✅ Set DTR+RTS high — exactly what PuTTY does on connect
  port.set({ dtr: true, rts: true }, (err) => {
    if (err) console.warn('set() error:', err);
    else console.log('DTR+RTS set high');

    setTimeout(() => {
      console.log('Sending CTRL+C...');
      port.write(Buffer.from([0x03]));
    }, 500);

    setTimeout(() => {
      console.log('Sending Enter...');
      port.write(Buffer.from([0x0D]));
    }, 1000);

    setTimeout(() => {
      console.log('Sending print...');
      port.write(Buffer.from('print("hello from node")\r\n', 'utf8'));
    }, 1500);
  });
});