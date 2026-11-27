package com.smartpark.controller;

import com.smartpark.dto.DashboardDataDtos.*;
import com.smartpark.model.*;
import com.smartpark.repository.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardDataController {
  private final UserRepository users;
  private final LocationRepository locations;
  private final BookingRepository bookings;
  private final PaymentRepository payments;

  public DashboardDataController(UserRepository users, LocationRepository locations,
                                 BookingRepository bookings, PaymentRepository payments) {
    this.users=users;
    this.locations=locations;
    this.bookings=bookings;
    this.payments=payments;
  }

  @GetMapping("/data")
  @PreAuthorize("isAuthenticated()")
  @Transactional(readOnly=true)
  public DashboardData data(@AuthenticationPrincipal User currentUser) {
    List<User> allUsers=users.findAll();
    Map<String,User> usersById=allUsers.stream()
      .collect(Collectors.toMap(User::getId, Function.identity()));

    List<ParkingLocation> visibleLocations=locations.findAllWithSlots().stream()
      .filter(location -> currentUser.getRole()!=Role.OWNER ||
        currentUser.getId().equals(location.getOwnerId()))
      .toList();
    Map<String,ParkingLocation> locationsById=visibleLocations.stream()
      .collect(Collectors.toMap(ParkingLocation::getId, Function.identity()));
    Set<String> visibleLocationIds=locationsById.keySet();

    List<Booking> visibleBookings;
    if (currentUser.getRole()==Role.ADMIN) {
      visibleBookings=bookings.findAllByOrderByCreatedAtDesc();
    } else if (currentUser.getRole()==Role.CUSTOMER) {
      visibleBookings=bookings.findByCustomerIdOrderByCreatedAtDesc(currentUser.getId());
    } else {
      visibleBookings=bookings.findAllByOrderByCreatedAtDesc().stream()
        .filter(booking -> visibleLocationIds.contains(booking.getLocationId()))
        .toList();
    }

    Set<String> visibleBookingIds=visibleBookings.stream()
      .map(Booking::getId).collect(Collectors.toSet());
    Map<String,Payment> paymentsByBookingId=payments.findAll().stream()
      .filter(payment -> visibleBookingIds.contains(payment.getBookingId()))
      .collect(Collectors.toMap(Payment::getBookingId, Function.identity()));

    List<LocationData> locationData=visibleLocations.stream().map(location ->
      new LocationData(
        location.getId(), location.getName(), location.getAddress(), location.getCity(),
        location.getOwnerId(),
        emailFor(usersById.get(location.getOwnerId())),
        location.getLatitude(), location.getLongitude(), location.getPricePerHour(),
        location.getStatus(), location.getUpdatedAt(), location.getSlots().size(),
        location.getSlots().stream().filter(slot -> "Available".equalsIgnoreCase(slot.getStatus())).count(),
        location.getSlots().stream().map(slot ->
          new SlotData(slot.getId(), slot.getCode(), slot.getStatus())).toList()
      )
    ).toList();

    List<BookingData> bookingData=visibleBookings.stream().map(booking -> {
      ParkingLocation location=locationsById.get(booking.getLocationId());
      Payment payment=paymentsByBookingId.get(booking.getId());
      return new BookingData(
        booking.getId(), booking.getCustomerId(),
        emailFor(usersById.get(booking.getCustomerId())),
        booking.getLocationId(), location==null ? "Unavailable location" : location.getName(),
        booking.getSlotId(), booking.getVehicleNumber(), booking.getStartTime(),
        booking.getEndTime(), booking.getStatus(), booking.getAmount(),
        booking.getCreatedAt(), payment==null ? "No payment record" : payment.getStatus()
      );
    }).toList();

    List<PaymentData> paymentData=paymentsByBookingId.values().stream().map(payment ->
      new PaymentData(payment.getId(), payment.getBookingId(), payment.getAmount(),
        payment.getStatus(), payment.getProvider(), payment.getCreatedAt())
    ).toList();

    List<UserData> userData=allUsers.stream()
      .filter(user -> currentUser.getRole()==Role.ADMIN ||
        user.getId().equals(currentUser.getId()))
      .map(user -> new UserData(
        user.getId(), user.getName(), user.getEmail(), user.getRole().name().toLowerCase(),
        user.getAccountStatus(), user.getOwnerVerification(), user.getCreatedAt()
      )).toList();

    return new DashboardData(locationData, bookingData, paymentData, userData);
  }

  private String emailFor(User user) {
    return user==null ? "" : user.getEmail();
  }
}
