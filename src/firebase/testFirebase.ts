import { collection, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { db } from './firebaseConfig';

/**
 * Firebase Connection Test Utility
 * 
 * Simple functions to test if Firebase is working properly
 */

/**
 * Test basic Firebase write operation
 * This will create a document in users/{userId}/test_data collection
 */
export const testFirebaseWrite = async (userId: string): Promise<boolean> => {
  try {
    console.log('[Firebase Test] 🧪 Starting write test...');
    
    // Create a simple test document
    const testData = {
      message: 'Hello from Firebase!',
      timestamp: serverTimestamp(),
      testNumber: Math.random(),
      testBoolean: true,
      testArray: [1, 2, 3],
      testObject: {
        nested: 'value',
        count: 42
      }
    };
    
    // Try to write to Firebase
    const docRef = await addDoc(
      collection(db, 'users', userId, 'test_data'), 
      testData
    );
    
    console.log('[Firebase Test] ✅ SUCCESS! Document written with ID:', docRef.id);
    console.log('[Firebase Test] 📍 Path: users/', userId, '/test_data/', docRef.id);
    console.log('[Firebase Test] 📊 Data:', testData);
    
    return true;
  } catch (error) {
    console.error('[Firebase Test] ❌ FAILED to write:', error);
    console.error('[Firebase Test] Error details:', JSON.stringify(error, null, 2));
    return false;
  }
};

/**
 * Test writing a simple sensor reading
 */
export const testSensorWrite = async (userId: string): Promise<boolean> => {
  try {
    console.log('[Firebase Test] 🧪 Testing sensor data write...');
    
    const testSensorData = {
      sensorType: 'TEST_SENSOR',
      value: 123.45,
      unit: 'test_units',
      timestamp: serverTimestamp(),
      deviceName: 'Test Device',
      note: 'This is a test reading'
    };
    
    const docRef = await addDoc(
      collection(db, 'users', userId, 'sensor_data', 'test', 'readings'),
      testSensorData
    );
    
    console.log('[Firebase Test] ✅ Sensor test SUCCESS! Document ID:', docRef.id);
    console.log('[Firebase Test] 📍 Path: users/', userId, '/sensor_data/test/readings/', docRef.id);
    
    return true;
  } catch (error) {
    console.error('[Firebase Test] ❌ Sensor test FAILED:', error);
    return false;
  }
};

/**
 * Test writing with document ID
 */
export const testFirebaseWriteWithId = async (userId: string): Promise<boolean> => {
  try {
    console.log('[Firebase Test] 🧪 Testing write with custom ID...');
    
    const testId = `test_${Date.now()}`;
    await setDoc(
      doc(db, 'users', userId, 'test_data', testId),
      {
        message: 'Test with custom ID',
        timestamp: serverTimestamp(),
        customId: testId
      }
    );
    
    console.log('[Firebase Test] ✅ Write with ID SUCCESS! Document ID:', testId);
    return true;
  } catch (error) {
    console.error('[Firebase Test] ❌ Write with ID FAILED:', error);
    return false;
  }
};

/**
 * Comprehensive Firebase test
 * Runs all tests and reports results
 */
export const runFirebaseTests = async (userId: string): Promise<void> => {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 FIREBASE CONNECTION TEST SUITE');
  console.log('='.repeat(60));
  console.log('User ID:', userId);
  console.log('Project:', 'smartstim-28b2a');
  console.log('Time:', new Date().toISOString());
  console.log('='.repeat(60) + '\n');
  
  const results = {
    basicWrite: false,
    writeWithId: false,
    sensorWrite: false,
  };
  
  // Test 1: Basic write
  console.log('\n📝 Test 1: Basic Write Operation');
  results.basicWrite = await testFirebaseWrite(userId);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 2: Write with custom ID
  console.log('\n📝 Test 2: Write with Custom ID');
  results.writeWithId = await testFirebaseWriteWithId(userId);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 3: Sensor data write
  console.log('\n📝 Test 3: Sensor Data Write');
  results.sensorWrite = await testSensorWrite(userId);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log('Basic Write:', results.basicWrite ? '✅ PASS' : '❌ FAIL');
  console.log('Write with ID:', results.writeWithId ? '✅ PASS' : '❌ FAIL');
  console.log('Sensor Write:', results.sensorWrite ? '✅ PASS' : '❌ FAIL');
  console.log('='.repeat(60));
  
  const allPassed = Object.values(results).every(r => r);
  
  if (allPassed) {
    console.log('\n🎉 ALL TESTS PASSED! Firebase is working correctly.');
    console.log('📍 Check Firebase Console at:');
    console.log('   https://console.firebase.google.com/project/smartstim-28b2a/firestore');
    console.log('   Look in: users/' + userId + '/test_data');
  } else {
    console.log('\n❌ SOME TESTS FAILED. Possible issues:');
    console.log('   1. Not logged in to Firebase');
    console.log('   2. Security rules not deployed');
    console.log('   3. Network connection issues');
    console.log('   4. Firebase config incorrect');
    console.log('\n💡 Try running: firebase deploy --only firestore:rules');
  }
  
  console.log('\n');
};

/**
 * Quick test - saves a single test document
 */
export const quickFirebaseTest = async (userId: string): Promise<void> => {
  console.log('🧪 Quick Firebase Test...');
  console.log('User ID:', userId);
  
  try {
    const testDoc = {
      test: 'Quick Firebase Test',
      timestamp: serverTimestamp(),
      random: Math.random(),
      date: new Date().toISOString()
    };
    
    const docRef = await addDoc(
      collection(db, 'users', userId, 'test_data'),
      testDoc
    );
    
    console.log('✅ SUCCESS! Firebase is working!');
    console.log('Document ID:', docRef.id);
    console.log('Check Firebase Console at:');
    console.log('https://console.firebase.google.com/project/smartstim-28b2a/firestore');
    
    alert('✅ Firebase test succeeded! Check console for details.');
  } catch (error: any) {
    console.error('❌ Firebase test FAILED:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    alert('❌ Firebase test failed! Check console for details.');
  }
};
