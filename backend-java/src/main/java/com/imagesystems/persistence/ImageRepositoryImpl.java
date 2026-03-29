package com.imagesystems.persistence;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import org.springframework.stereotype.Repository;

@Repository
public class ImageRepositoryImpl implements ImageRepositoryCustom {

    @PersistenceContext
    private EntityManager em;

    @Override
    public List<ImageEntity> findByUserIdOrderByCreatedAtDesc(String userId, int offset, int limit) {
        return em.createQuery(
                        "SELECT DISTINCT i FROM ImageEntity i LEFT JOIN FETCH i.versions WHERE i.userId = :uid ORDER BY i.createdAt DESC",
                        ImageEntity.class)
                .setParameter("uid", userId)
                .setFirstResult(offset)
                .setMaxResults(limit)
                .getResultList();
    }
}
