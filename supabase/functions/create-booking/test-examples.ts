/**
 * Test examples for the create-booking Edge Function
 * 
 * These examples can be used to test the booking creation functionality
 * Replace YOUR_JWT_TOKEN with a valid Supabase auth token
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Example 1: Basic booking with minimum required fields
async function testBasicBooking() {
  const { data, error } = await supabase.functions.invoke('create-booking', {
    body: {
      customerName: 'John Smith',
      vehicleName: 'Ferrari SF90',
      startDate: '2024-03-15',
      endDate: '2024-03-20',
      location: 'Miami Beach'
    }
  });

  console.log('Basic Booking Result:', data, error);
}

// Example 2: Full booking with all optional fields
async function testFullBooking() {
  const { data, error } = await supabase.functions.invoke('create-booking', {
    body: {
      customerName: 'Sarah Johnson',
      customerEmail: 'sarah@example.com',
      customerPhone: '+1-305-555-0123',
      vehicleName: 'McLaren 720S',
      startDate: '2024-04-01T10:00:00Z',
      endDate: '2024-04-07T10:00:00Z',
      location: 'Miami International Airport',
      dropoffLocation: 'Fort Lauderdale Airport',
      status: 'confirmed',
      notes: 'Customer prefers early morning pickup. VIP treatment requested.',
      dailyRate: 1800,
      depositAmount: 2500,
      securityDepositAmount: 4000,
      requiresDelivery: true,
      deliveryAddress: '100 Lincoln Road, Miami Beach, FL 33139',
      deliveryFee: 200
    }
  });

  console.log('Full Booking Result:', data, error);
}

// Example 3: Weekend rental
async function testWeekendRental() {
  const { data, error } = await supabase.functions.invoke('create-booking', {
    body: {
      customerName: 'Michael Brown',
      customerEmail: 'michael@example.com',
      customerPhone: '+1-305-555-0456',
      vehicleName: 'Lamborghini Aventador',
      startDate: '2024-03-22', // Friday
      endDate: '2024-03-24', // Sunday
      location: 'South Beach',
      status: 'pending',
      notes: 'Weekend getaway rental'
    }
  });

  console.log('Weekend Rental Result:', data, error);
}

// Example 4: Long-term rental (1 week)
async function testLongTermRental() {
  const { data, error } = await supabase.functions.invoke('create-booking', {
    body: {
      customerName: 'Emily Davis',
      customerEmail: 'emily@example.com',
      vehicleName: 'Porsche 911 Turbo S',
      startDate: '2024-05-01',
      endDate: '2024-05-08',
      location: 'Downtown Miami',
      dropoffLocation: 'Downtown Miami',
      status: 'confirmed',
      notes: 'Business trip - needs parking pass'
    }
  });

  console.log('Long-term Rental Result:', data, error);
}

// Example 5: Using vehicleId instead of vehicleName
async function testWithVehicleId() {
  const vehicleId = '123e4567-e89b-12d3-a456-426614174000'; // Replace with actual vehicle ID

  const { data, error } = await supabase.functions.invoke('create-booking', {
    body: {
      customerName: 'Robert Wilson',
      customerEmail: 'robert@example.com',
      vehicleId: vehicleId,
      startDate: '2024-06-01',
      endDate: '2024-06-05',
      location: 'Miami Beach',
      status: 'pending'
    }
  });

  console.log('Booking with Vehicle ID Result:', data, error);
}

// Example 6: Test error handling - invalid date range
async function testInvalidDateRange() {
  const { data, error } = await supabase.functions.invoke('create-booking', {
    body: {
      customerName: 'Test User',
      vehicleName: 'Ferrari',
      startDate: '2024-03-20',
      endDate: '2024-03-15', // End before start - should fail
      location: 'Miami'
    }
  });

  console.log('Invalid Date Range Result:', data, error);
}

// Example 7: Test error handling - vehicle not found
async function testVehicleNotFound() {
  const { data, error } = await supabase.functions.invoke('create-booking', {
    body: {
      customerName: 'Test User',
      vehicleName: 'Nonexistent Vehicle 9999',
      startDate: '2024-03-15',
      endDate: '2024-03-20',
      location: 'Miami'
    }
  });

  console.log('Vehicle Not Found Result:', data, error);
}

// Example 8: Test vehicle availability check
async function testConflictingBooking() {
  // First, create a booking
  const { data: booking1 } = await supabase.functions.invoke('create-booking', {
    body: {
      customerName: 'First Customer',
      vehicleName: 'Ferrari SF90',
      startDate: '2024-07-01',
      endDate: '2024-07-05',
      location: 'Miami',
      status: 'confirmed'
    }
  });

  console.log('First Booking:', booking1);

  // Try to create a conflicting booking
  const { data: booking2, error } = await supabase.functions.invoke('create-booking', {
    body: {
      customerName: 'Second Customer',
      vehicleName: 'Ferrari SF90',
      startDate: '2024-07-03', // Overlaps with first booking
      endDate: '2024-07-07',
      location: 'Miami',
      status: 'confirmed'
    }
  });

  console.log('Conflicting Booking Result:', booking2, error);
}

// Run all tests
async function runAllTests() {
  console.log('=== Running Create Booking Tests ===\n');

  console.log('Test 1: Basic Booking');
  await testBasicBooking();
  console.log('\n---\n');

  console.log('Test 2: Full Booking');
  await testFullBooking();
  console.log('\n---\n');

  console.log('Test 3: Weekend Rental');
  await testWeekendRental();
  console.log('\n---\n');

  console.log('Test 4: Long-term Rental');
  await testLongTermRental();
  console.log('\n---\n');

  console.log('Test 5: With Vehicle ID');
  await testWithVehicleId();
  console.log('\n---\n');

  console.log('Test 6: Invalid Date Range');
  await testInvalidDateRange();
  console.log('\n---\n');

  console.log('Test 7: Vehicle Not Found');
  await testVehicleNotFound();
  console.log('\n---\n');

  console.log('Test 8: Conflicting Booking');
  await testConflictingBooking();
  console.log('\n---\n');

  console.log('=== Tests Complete ===');
}

// Export for use in testing framework
export {
  testBasicBooking,
  testFullBooking,
  testWeekendRental,
  testLongTermRental,
  testWithVehicleId,
  testInvalidDateRange,
  testVehicleNotFound,
  testConflictingBooking,
  runAllTests
};

// Uncomment to run tests directly
// runAllTests();
