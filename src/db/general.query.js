const db = require(".");

const formatDateForMySQL = (isoDate) => {
  return new Date(isoDate).toISOString().slice(0, 19).replace("T", " ");
};

async function addImageNews({ image, expiry, roles, type }) {
  const news = await db.query(
    `INSERT INTO news (image, expiry_time, role, type) 
     VALUES (?, ?, ?, ?)`,
    [image, expiry, JSON.stringify(roles), "image"]
  );

  return news[0];
}

async function addTextNews({ title, description, expiry, roles, type }) {
  const news = await db.query(
    `INSERT INTO news (title, description, expiry_time, role, type) 
       VALUES (?, ?, ?, ?, ?)`,
    [title, description, expiry, JSON.stringify(roles), type]
  );

  return news[0];
}

async function updateNews({
  id,
  title,
  description,
  image,
  expiry,
  roles,
  is_public
}) {
  const formattedExpiry = formatDateForMySQL(expiry); // Convert expiry to MySQL format

  const news = await db.query(
    `UPDATE news 
       SET title = ?, 
           description = ?, 
           image = ?, 
           expiry_time = ?, 
           role = ?, 
           is_public = ? 
       WHERE id = ?`,
    [
      title,
      description,
      image,
      formattedExpiry,
      JSON.stringify(roles),
      is_public,
      id
    ]
  );

  return news[0];
}

async function getNews(role) {
  let news = [];
  if (role === 1 || role === 2) {
    [news] = await db.query(`SELECT * FROM news `);
    return news;
  } else {
    [news] = await db.query(
      `SELECT * FROM news  WHERE is_public = ?  and  JSON_CONTAINS(role, '?', '$')  AND (expiry_time > NOW() OR expiry_time IS NULL)  ORDER BY created_at`,
      [true, role]
    );
  }

  console.log("news", news);
  return news;
}
// async function getNews(role) {
//   const news = await db.query(
//     `SELECT * FROM news
//      WHERE JSON_CONTAINS(role, JSON_QUOTE(?))
//      AND (expiry_time > NOW() OR expiry_time IS NULL)`,
//     [role]
//   );

//   return news;
// }

module.exports = {
  addImageNews,
  addTextNews,
  updateNews,
  getNews
};
