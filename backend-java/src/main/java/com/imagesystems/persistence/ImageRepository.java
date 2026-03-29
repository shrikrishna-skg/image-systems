package com.imagesystems.persistence;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ImageRepository extends JpaRepository<ImageEntity, String>, ImageRepositoryCustom {

    @EntityGraph(attributePaths = {"versions"})
    Optional<ImageEntity> findByIdAndUserId(String id, String userId);
}
