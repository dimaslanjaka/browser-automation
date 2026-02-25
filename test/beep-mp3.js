import { playMp3FromUrl } from '../src/beep.js';
import { sleep } from '../src/utils.js';

await playMp3FromUrl('https://media.geeksforgeeks.org/wp-content/uploads/20190531135120/beep.mp3').catch(console.error);
await sleep(1500);
await playMp3FromUrl('https://assets.mixkit.co/active_storage/sfx/1084/1084.wav').catch(console.error);
await sleep(1500);
