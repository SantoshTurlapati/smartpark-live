package com.smartpark.repository;
import com.smartpark.model.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface BookingRepository extends JpaRepository<Booking,String> {
  List<Booking> findByCustomerIdOrderByCreatedAtDesc(String customerId);
  List<Booking> findAllByOrderByCreatedAtDesc();
  List<Booking> findByLocationIdOrderByCreatedAtDesc(String locationId);
}
