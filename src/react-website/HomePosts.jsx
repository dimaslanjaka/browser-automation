import React from 'react';
import { Card, Col, Row } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

function HomePosts() {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [posts, setPosts] = React.useState([]);

  React.useEffect(() => {
    import('./components/post-lists.json').then((module) => setPosts(module.default)).catch(() => setPosts([]));
  }, []);

  const filteredPosts = posts.filter(
    (post) =>
      post.title.toLowerCase().includes(search.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="my-4">
      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Search posts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Row xs={1} sm={2} md={3} lg={4} className="g-4">
        {filteredPosts.map((post, id) => (
          <Col key={id} className="d-flex align-items-stretch">
            <div
              role="button"
              tabIndex={0}
              style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', width: '100%', height: '100%' }}
              onClick={() => navigate(post.href)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') navigate(post.href);
              }}>
              <Card className="h-100 shadow-sm d-flex flex-column" style={{ height: '100%' }}>
                <Card.Img variant="top" src={post.image} alt={post.title} style={{ objectFit: 'cover', height: 180 }} />
                <Card.Body className="d-flex flex-column flex-grow-1">
                  <Card.Title>{post.title}</Card.Title>
                  <Card.Text className="flex-grow-1">{post.excerpt}</Card.Text>
                </Card.Body>
              </Card>
            </div>
          </Col>
        ))}
        {filteredPosts.length === 0 && (
          <Col>
            <div className="text-center text-muted py-5">No posts found.</div>
          </Col>
        )}
      </Row>
    </div>
  );
}

export default HomePosts;
