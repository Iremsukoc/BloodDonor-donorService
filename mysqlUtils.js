const mysql = require('mysql2/promise');

let pool = null;

const getMysqlPool = () => {
  try {
    if (!pool) {
      pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        waitForConnections: true,
        connectionLimit: process.env.DB_CONNECTION_LIMIT || 10,
        queueLimit: 0
      });

      console.log('Connection pool created successfully');
    }
    return pool;
  } catch (error) {
    console.error(`Connection pool creation failed: ${error}`);
    return null;
  }
};

const closeMysqlConnection = () => {
  if (pool) {
    pool.end();
    console.log('Connection pool closed');
  }
};

const tableExists = (tableName) => {
  if (pool) {
    try {
      const query = `SHOW TABLES LIKE '${tableName}'`;
      pool.query(query, (err, result) => {
        if (err) {
          console.error(`Table check failed: ${err}`);
        } else {
          if (result.length > 0) {
            console.log('Table exists.');
          } else {
            console.log('Table does not exist.');
          }
        }
      });
    } catch (error) {
      console.error(`Table check failed: ${error}`);
    }
  } else {
    console.log('No connection pool available.');
  }
};

const getInformationOfAllDonors = async (userId) => {
  const pool = getMysqlPool();
  if (pool) {
    try {
      const getDataSQL = 'SELECT donor_name, blood_type, city, town FROM donor WHERE branch_id=?';
      const value= [userId]
      const [rows] = await pool.query(getDataSQL, value);
      console.log('Data retrieved successfully.');
      return rows;
    } catch (error) {
      console.error('Data could not be retrieved:', error);
      return null;
    }
  } else {
    console.log('No connection pool available.');
    return null;
  }
};


const insertNewDonor = async (donor_name, blood_type, city, town, phone_number, userId, imageUrl) => {
  const pool = getMysqlPool();
  if (pool) {
    try {
      const addDonor = 'INSERT INTO donor (donor_name, blood_type, units_of_blood, city, town, phone_number, branch_id, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
      const values = [donor_name, blood_type, null, city, town, phone_number, userId, imageUrl];
      await pool.execute(addDonor, values);
      console.log('Data added successfully.');
    } catch (error) {
      console.error('New donor could not be added:', error);
    }
  } else {
    console.log('No connection pool available.');
  }
};

const getPaginatedDonors = async (userId, page, pageSize) => {
  const pool = getMysqlPool();

  if (pool) {
    try {
      const getDonorsSQL = 'SELECT donor_name, blood_type, city, town , phone_number FROM donor WHERE branch_id = ? ORDER BY iddonor DESC LIMIT ? OFFSET ?';
      const offset = (page - 1) * pageSize;
      const [rows] = await pool.query(getDonorsSQL, [userId, pageSize, offset]);

      if (rows.length > 0) {
        console.log('Data retrieved successfully.');
        return rows;
      } else {
        console.log('Donors not found.');
        return null;
      }
    } catch (error) {
      console.error('Error retrieving donors:', error);
      return null;
    }
  } else {
    console.log('No connection pool available.');
    return null;
  }
};

const branchValid = async (username, password) => {
  const pool = getMysqlPool();

  if (!pool) {
    console.error('No MySQL connection pool available.');
    return { userId: null};
  }

  try {
    const query = 'SELECT idbranch FROM `branch` WHERE branch_name = ? AND branch_password = ? LIMIT 1';
    const values = [username, password];

    console.log('SQL Query:', pool.format(query, values));

    const [results] = await pool.execute(query, values);

    console.log('Results:', results);

    if (results.length > 0) {
      const { idbranch} = results[0];
      console.log("Branch exists and password is correct.");
      return { userId: idbranch };
    } else {
      console.log("Branch does not exist or password is incorrect.");
      return { userId: null };
    }
  } catch (error) {
    console.error(`Error in branch validation: ${error}`);
    return { userId: null };
  }
};


const findBranchName = async(userId) => {
  const pool = getMysqlPool();

  if(!pool){
    console.error('No MySQL connection pool available.');
    return { branchName: null};
  }

  try {
    const query = 'SELECT name FROM `branch` WHERE idbranch = ? LIMIT 1';
    const values = [userId];

    console.log('SQL Query:', pool.format(query, values));

    const [results] = await pool.execute(query, values);

    console.log('Results:', results);

    return { branchName: results[0].name }; 

  } catch (error) {
    console.error(`Error in branch name validation: ${error}`);
    return { userId: null };
  }
};


const deleteDonor = async (phoneNumber) => {
  const pool = getMysqlPool();


  if(!pool){
    console.error('No MySQL connection pool available.');
    return { branchName: null};
  }

  try{


    const deleteQuery = 'DELETE FROM donor WHERE phone_number = ?';
    const value = [phoneNumber];

    const result = await pool.execute(deleteQuery,value);

    console.log('Donor deleted successfully:', result);

  }catch (error) {
    console.error(`Error delete: ${error}`);
    return { userId: null };
  }


};




const fetchDonorsName = async (userId, donorName) => {
  const pool = getMysqlPool();


  if(!pool){
    console.error('No MySQL connection pool available.');
    return { userId: null, donorName:null};
  }

  try{


    const fetchQuery = 'SELECT iddonor, donor_name, blood_type FROM donor WHERE branch_id = ? AND donor_name LIKE ?';
    const value = [userId, `%${donorName}%`];

    const [rows] = await pool.execute(fetchQuery, value);


    const results = rows.map(row => ({
      iddonor: row.iddonor,
      donor_name: row.donor_name,
      blood_type: row.blood_type,
    }));

    console.log('Donors fetched successfully:', results);

    return { results };

  }catch (error) {
    console.error(`Error fetch: ${error}`);
    return { userId: null, donorName:null };
  }


};


const setBloodUnits = async (iddonor, unitsOfBlood) => {
  try {
    const query = 'UPDATE donor SET units_of_blood = ? WHERE iddonor = ?';
    const result = await pool.query(query, [unitsOfBlood, iddonor]);

    if (result.affectedRows === 0) {
      throw new Error('Donor not found or blood units not updated.');
    }

    console.log(`Blood units updated for donor ${iddonor}`);
  } catch (error) {
    console.error('Error updating blood units:', error);
    throw error;
  }
};




const searchBlood = async (city, town, bloodType, units) => {
  const pool = getMysqlPool();

  if (!pool) {
    console.error('No MySQL connection pool available.');
    return null;
  }

  try {
    const lowerCaseCity = city.toLowerCase();
    const lowerCaseTown = town.toLowerCase();

    console.log(`Searching blood for ${units} units in ${lowerCaseCity}, ${lowerCaseTown} with blood type ${bloodType}...`);

    const branchQuery = 'SELECT idbranch FROM branch WHERE LOWER(city) = ? AND LOWER(town) = ?';
    const branchValues = [lowerCaseCity, lowerCaseTown];
    const [branchRows] = await pool.execute(branchQuery, branchValues);

    console.log(`Branches in ${lowerCaseCity}, ${lowerCaseTown}:`, branchRows);

    if (branchRows.length === 0) {
      console.log('No branches found. Returning rabbitmq.');
      return 'rabbitmq';
    }

    // Donor query
    const donorQuery = 'SELECT iddonor, units_of_blood FROM donor WHERE branch_id IN (?) AND blood_type = ?';
    const formattedDonorQuery = pool.format(donorQuery, [branchRows.map((row) => row.idbranch), bloodType]);

    console.log('donorQuery:', formattedDonorQuery);

    const [donorRows] = await pool.execute(formattedDonorQuery);
    console.log(`Donors with blood type ${bloodType} in selected branches:`, donorRows);

    const totalBloodUnits = donorRows.reduce((sum, row) => sum + row.units_of_blood, 0);
    console.log(`Total blood units available: ${totalBloodUnits}`);

    if (totalBloodUnits >= units) {
      console.log(`Blood search for ${units} units in ${lowerCaseCity}, ${lowerCaseTown} with blood type ${bloodType}. Total units: ${totalBloodUnits}`);

      const sortedDonors = donorRows.sort((a, b) => a.units_of_blood - b.units_of_blood);

      for (const donor of sortedDonors) {
        const remainingUnits = donor.units_of_blood - units;

        if (remainingUnits >= 0) {
          await pool.execute('UPDATE donor SET units_of_blood = ? WHERE iddonor = ?', [remainingUnits, donor.iddonor]);
          console.log(`Updated donor ${donor.iddonor}. Remaining units: ${remainingUnits}`);
          break;
        } else {
          await pool.execute('UPDATE donor SET units_of_blood = 0 WHERE iddonor = ?', [donor.iddonor]);
          units -= donor.units_of_blood;
          console.log(`Updated donor ${donor.iddonor}. Remaining units: 0. ${units} units left.`);
        }
      }

      return 'successful';
    } else {
      console.log(`Not enough blood units available. Total units: ${totalBloodUnits}`);
      return 'rabbitmq';
    }
  } catch (error) {
    console.error('Error searching blood:', error);
    return null;
  }
};




module.exports = {
  getMysqlPool,
  closeMysqlConnection,
  tableExists,
  getInformationOfAllDonors,
  insertNewDonor,
  getPaginatedDonors,
  branchValid,
  findBranchName,
  deleteDonor,
  fetchDonorsName,
  setBloodUnits,
  searchBlood,
};