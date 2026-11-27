package com.smartpark.repository;
import com.smartpark.model.ParkingSlot;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface SlotRepository extends JpaRepository<ParkingSlot,String> {
  List<ParkingSlot> findByLocation_Id(String locationId);
}
