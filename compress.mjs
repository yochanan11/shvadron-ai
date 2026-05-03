import sharp from 'sharp';
await sharp('C:\\Users\\יוחנן שבדרון\\Downloads\\dn\\assets\\public\\images\\brand\\yochanan-character.png').webp({quality:82}).toFile('C:\\Users\\יוחנן שבדרון\\Downloads\\dn\\assets\\public\\images\\brand\\yochanan-character.webp');
console.log('hero done');
await sharp('C:\\Users\\יוחנן שבדרון\\Downloads\\dn\\assets\\public\\yochanan-card.jpg').webp({quality:80}).toFile('C:\\Users\\יוחנן שבדרון\\Downloads\\dn\\assets\\public\\yochanan-card.webp');
console.log('card done');
