package com.imagesystems.persistence;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ImageVersionRepository extends JpaRepository<ImageVersionEntity, String> {

    Optional<ImageVersionEntity> findByIdAndImageId(String id, String imageId);

    List<ImageVersionEntity> findTop1ByImageIdOrderByCreatedAtDesc(String imageId);
}
