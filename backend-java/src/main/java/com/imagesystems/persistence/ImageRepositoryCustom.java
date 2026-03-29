package com.imagesystems.persistence;

import java.util.List;

public interface ImageRepositoryCustom {

    List<ImageEntity> findByUserIdOrderByCreatedAtDesc(String userId, int offset, int limit);
}
